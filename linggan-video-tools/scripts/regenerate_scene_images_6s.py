#!/usr/bin/env python3
"""通用分镜图重生成脚本（Skill 版本，参数化，不写死项目内容）。

核心改进：
- 所有输入文件/输出文件都走参数
- 支持 script 来源可选（compose/prompt/text）
- 支持 prompt 约束通过参数传入，不再写死
"""

from __future__ import annotations

import argparse
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Any

import requests

DEFAULT_CONSTRAINT = (
    "分镜图，必须9:16竖版。严格遵循 script 内的当前段场景地点、时间、动作与情绪，不得替换成其他地点。"
    "人物必须与参考图一致且必须出镜，画面要体现人物关系与动作叙事。"
    "禁止纯人物立绘、禁止白底棚拍、禁止与 script 冲突的背景。"
    "镜头语言电影写实，构图清晰，叙事明确。 "
    "Framing constraint: output composition must strictly use 9:16 (vertical portrait). "
    "Do not use any aspect ratio other than 9:16. Do not produce square framing."
)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def load_segments(path: Path) -> list[dict[str, Any]]:
    raw = read_json(path)
    if isinstance(raw, list):
        return [x for x in raw if isinstance(x, dict)]
    if isinstance(raw, dict):
        for key in ("segments", "items"):
            if isinstance(raw.get(key), list):
                return [x for x in raw[key] if isinstance(x, dict)]
    raise ValueError(f"invalid segments json: {path}")


def load_prompt_map(path: Path | None) -> dict[str, str]:
    if not path or not path.exists():
        return {}
    raw = read_json(path)
    out: dict[str, str] = {}
    items = raw.get("items") if isinstance(raw, dict) else []
    if isinstance(items, list):
        for it in items:
            if not isinstance(it, dict):
                continue
            sid = str(it.get("segmentId") or it.get("id") or "").strip()
            p = str(it.get("prompt") or "").strip()
            if sid and p:
                out[sid] = p
    return out


def load_characters(path: Path) -> tuple[list[str], list[str]]:
    raw = read_json(path)
    chars = raw.get("characters") if isinstance(raw, dict) else []
    names: list[str] = []
    urls: list[str] = []
    for c in chars if isinstance(chars, list) else []:
        if not isinstance(c, dict):
            continue
        n = str(c.get("name") or "").strip()
        u = str(c.get("imageUrl") or "").strip()
        if n:
            names.append(n)
        if u:
            urls.append(u)
    return names, urls


def seg_id(seg: dict[str, Any], i: int) -> str:
    return str(seg.get("segmentId") or seg.get("id") or seg.get("name") or f"S{i+1:02d}")


def compose_script(seg: dict[str, Any]) -> str:
    scene = str(seg.get("scene") or "").strip()
    visual = str(seg.get("visual") or "").strip()
    dialogue = str(seg.get("dialogue") or "").strip()
    composed = "，".join([x for x in (scene, visual, dialogue) if x])
    if composed:
        return composed
    for k in ("script", "text", "content", "description", "prompt"):
        v = seg.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return json.dumps(seg, ensure_ascii=False)


def extract_image_url(body: Any) -> str | None:
    if isinstance(body, dict):
        for k in ("sceneImageUrl", "scene_image_url", "imageUrl", "image_url", "url", "oss_url"):
            v = body.get(k)
            if isinstance(v, str) and v.startswith("http"):
                return v
        for k in ("data", "result", "output"):
            if k in body:
                u = extract_image_url(body[k])
                if u:
                    return u
    elif isinstance(body, list):
        for x in body:
            u = extract_image_url(x)
            if u:
                return u
    return None


def one_call(
    base: str,
    token: str,
    seg: dict[str, Any],
    sid: str,
    names: list[str],
    urls: list[str],
    prompt_map: dict[str, str],
    script_source: str,
    global_script: str,
    prompt_constraint: str,
    size: str,
    provider: str,
    model: str,
) -> dict[str, Any]:
    composed = compose_script(seg)
    prompt_script = prompt_map.get(sid, "")

    if script_source == "prompt":
        script = prompt_script or composed
    elif script_source == "text":
        script = global_script or composed
    else:
        script = composed

    if prompt_script:
        prompt_override = f"{prompt_script}\n\n{prompt_constraint}"
    else:
        prompt_override = f"当前段 script：{script}\n{prompt_constraint}"

    payload = {
        "script": script,
        "scene": seg.get("scene", ""),
        "character_names": names,
        "character_image_urls": urls,
        "style_hint": "",
        "prompt_override": prompt_override,
        "size": size,
        "collage_layout": "single",
        "provider": provider,
        "model": model,
    }

    headers: dict[str, str] = {}
    if token.strip():
        headers["token"] = token.strip()
        headers["Authorization"] = f"Bearer {token.strip()}"
    if api_key.strip():
        headers["Authorization"] = f"Bearer {api_key.strip()}"
    api = f"{base.rstrip('/')}/api/v1/short-drama/generate-shot-image-with-refs"

    rec: dict[str, Any] = {
        "segmentId": sid,
        "ok": False,
        "sceneImageUrl": None,
        "statusCode": None,
        "script": script,
        "promptOverride": prompt_override,
        "testedAt": datetime.now().isoformat(timespec="seconds"),
    }

    try:
        r = requests.post(api, json=payload, headers=headers, timeout=300)
        rec["statusCode"] = r.status_code
        try:
            body = r.json()
        except Exception:
            body = {"raw": r.text[:5000]}
        rec["response"] = body
        rec["sceneImageUrl"] = extract_image_url(body)
        rec["ok"] = bool(r.ok and rec["sceneImageUrl"])
        if not rec["ok"]:
            rec["error"] = body
    except Exception as e:
        rec["error"] = str(e)

    return rec


def main() -> int:
    ap = argparse.ArgumentParser(description="Regenerate storyboard images with parameterized script/prompt sources")
    ap.add_argument("--project-root", required=True)
    ap.add_argument("--segments-file", default="planning/segments-6s.json")
    ap.add_argument("--prompts-file", default="prompts/scene-image-prompts-6s.json")
    ap.add_argument("--characters-file", default="planning/characters-confirmed.json")
    ap.add_argument("--out-bindings", default="planning/scene-image-bindings-6s.json")
    ap.add_argument("--out-log", default="runs/image-jobs.jsonl")
    ap.add_argument("--raw-dir", default="logs/scene-raw")

    ap.add_argument("--token", default="")
    ap.add_argument("--api-key", default="")
    ap.add_argument("--base", default="https://uuerqapsftez.sealosgzg.site/")
    ap.add_argument("--max-workers", type=int, default=2)
    ap.add_argument("--only-ids", default="")

    ap.add_argument("--script-source", choices=["compose", "prompt", "text"], default="compose")
    ap.add_argument("--script-text", default="")
    ap.add_argument("--prompt-constraint", default=DEFAULT_CONSTRAINT)

    ap.add_argument("--size", default="1024*1792")
    ap.add_argument("--provider", default="chatgpt", choices=["chatgpt", "qwen"])
    ap.add_argument("--model", default="gpt-5-3")
    args = ap.parse_args()

    root = Path(args.project_root)
    segments_file = root / args.segments_file
    prompts_file = root / args.prompts_file
    characters_file = root / args.characters_file
    out_bindings = root / args.out_bindings
    out_log = root / args.out_log
    raw_dir = root / args.raw_dir

    segments = load_segments(segments_file)
    prompt_map = load_prompt_map(prompts_file)
    names, urls = load_characters(characters_file)

    if len(names) < 1 or len(urls) < 1:
        raise SystemExit("characters refs missing")

    only = {x.strip() for x in args.only_ids.split(",") if x.strip()}
    if only:
        filtered = []
        for i, s in enumerate(segments):
            sid = seg_id(s, i)
            if sid in only:
                filtered.append(s)
        segments = filtered

    if not segments:
        raise SystemExit("no segments to run")

    raw_dir.mkdir(parents=True, exist_ok=True)
    out_log.parent.mkdir(parents=True, exist_ok=True)
    out_bindings.parent.mkdir(parents=True, exist_ok=True)

    jobs: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=max(1, args.max_workers)) as ex:
        futs = []
        for i, seg in enumerate(segments):
            sid = seg_id(seg, i)
            futs.append(
                ex.submit(
                    one_call,
                    args.base,
                    args.token,
                    args.api_key,
                    seg,
                    sid,
                    names,
                    urls,
                    prompt_map,
                    args.script_source,
                    args.script_text,
                    args.prompt_constraint,
                    args.size,
                    args.provider,
                    args.model,
                )
            )

        for f in as_completed(futs):
            row = f.result()
            jobs.append(row)
            (raw_dir / f"{row['segmentId']}.json").write_text(json.dumps(row, ensure_ascii=False, indent=2), encoding="utf-8")
            with out_log.open("a", encoding="utf-8") as fp:
                fp.write(json.dumps(row, ensure_ascii=False) + "\n")
            print(f"[{row['segmentId']}] status={row['statusCode']} ok={row['ok']}")

    # merge bindings by segmentId
    current: dict[str, dict[str, Any]] = {}
    if out_bindings.exists():
        try:
            old = read_json(out_bindings)
            for b in (old.get("bindings") or old.get("items") or []):
                sid = str(b.get("segmentId") or "")
                if sid:
                    current[sid] = b
        except Exception:
            pass

    for j in jobs:
        sid = str(j.get("segmentId") or "")
        current[sid] = {
            "segmentId": sid,
            "ok": j.get("ok"),
            "sceneImageUrl": j.get("sceneImageUrl"),
            "statusCode": j.get("statusCode"),
        }

    # order by input segments
    order = {seg_id(s, i): i for i, s in enumerate(segments)}
    merged = sorted(current.values(), key=lambda x: order.get(str(x.get("segmentId") or ""), 10**9))

    out = {
        "stage": "scene-images-6s",
        "count": len(merged),
        "okCount": sum(1 for x in merged if x.get("ok")),
        "updatedAt": datetime.now().isoformat(timespec="seconds"),
        "bindings": merged,
    }
    out_bindings.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps({"okCount": out["okCount"], "total": out["count"], "ran": [j.get("segmentId") for j in jobs]}, ensure_ascii=False))
    return 0 if all(j.get("ok") for j in jobs) else 1


if __name__ == "__main__":
    raise SystemExit(main())
