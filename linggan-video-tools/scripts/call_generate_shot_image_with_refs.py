#!/usr/bin/env python3
"""调用 /v1/images/generations（单图），支持：
1) 文生图
2) 图生图
3) 参考图自动转 HTTPS（必要时上传到公共图床）
4) 结果自动下载到本地
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import requests

STRICT_FRAMING_CN = (
    "分镜图，必须9:16竖版。严格遵循 script 内的当前段场景地点、时间、动作与情绪，不得替换成其他地点。"
    "人物必须与参考图一致且必须出镜，画面要体现人物关系与动作叙事。"
    "禁止纯人物立绘、禁止白底棚拍、禁止与 script 冲突的背景。"
    "镜头语言与整体画风应遵循用户提示词，构图清晰，叙事明确。"
)

STRICT_FRAMING_EN = (
    "Framing constraint: output composition must strictly use 9:16 (vertical portrait). "
    "Do not use any aspect ratio other than 9:16. Do not produce square framing."
)

DEFAULT_PUBLIC_UPLOAD_URL = "https://imageproxy.zhongzhuan.chat/api/upload"


def _split_csv(raw: str) -> list[str]:
    return [v.strip() for v in (raw or "").split(",") if v.strip()]


def _is_9x16(size_text: str) -> bool:
    m = re.match(r"^\s*(\d+)\s*\*\s*(\d+)\s*$", size_text or "")
    if not m:
        return False
    w, h = int(m.group(1)), int(m.group(2))
    if h <= w:
        return False
    if (w, h) in {(1024, 1792), (1080, 1920), (720, 1280)}:
        return True
    ratio = w / h
    return abs(ratio - (9 / 16)) <= 0.02


def build_prompt_from_script(script: str, style_hint: str = "") -> str:
    script = (script or "").strip()
    style = style_hint.strip() or "不限制固定风格，按用户要求执行"
    return (
        f"当前段 script：{script}\n"
        f"风格要求：{style}。\n"
        f"{STRICT_FRAMING_CN}\n"
        f"{STRICT_FRAMING_EN}"
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="调用 /v1/images/generations（单图）。")
    parser.add_argument("--base-url", default="https://uuerqapsftez.sealosgzg.site/", help="网关地址")
    parser.add_argument("--token", default="", help="用户 token")
    parser.add_argument("--api-key", default="", help="网关 API Key")

    parser.add_argument("--script", required=True, help="分镜剧本（当前段）")
    parser.add_argument("--scene", default="", help="场景描述")
    parser.add_argument("--character-names", default="", help="人物名（逗号分隔）")
    parser.add_argument("--character-image-urls", default="", help="人物参考图 URL/路径（逗号分隔）")
    parser.add_argument("--image-url", default="", help="图生图输入图 URL/路径")
    parser.add_argument("--style-hint", default="", help="风格提示词")

    parser.add_argument("--size", default="1024*1792", help="输出尺寸，默认 1024*1792")
    parser.add_argument("--allow-non-9x16", action="store_true", help="允许非 9:16 尺寸（调试）")
    parser.add_argument("--model", default="gpt-image-1", help="生图模型")
    parser.add_argument("--prompt-override", default="", help="手动覆盖提示词")
    parser.add_argument("--prompt-only", action="store_true", help="仅输出提示词，不执行请求")

    parser.add_argument("--download-dir", default="", help="下载目录（默认脚本同级 outputs/images）")
    parser.add_argument("--filename-prefix", default="scene", help="下载文件名前缀")

    parser.add_argument("--upload-url", default=os.getenv("OPENAI_IMAGES_UPLOAD_URL", DEFAULT_PUBLIC_UPLOAD_URL), help="公共图床上传接口")
    parser.add_argument("--upload-api-key", default=os.getenv("OPENAI_IMAGES_UPLOAD_API_KEY", ""), help="公共图床 API Key（可选）")

    parser.add_argument("--timeout", type=int, default=180, help="超时秒数")
    parser.add_argument("--insecure", action="store_true", help="跳过 TLS 校验（仅调试）")
    return parser.parse_args()


def _default_download_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "outputs" / "images"


def _guess_ext_from_url(url: str) -> str:
    m = re.search(r"\.([a-zA-Z0-9]{2,5})(?:\?|#|$)", url or "")
    if not m:
        return ""
    ext = "." + m.group(1).lower()
    if ext == ".jpeg":
        ext = ".jpg"
    return ext if ext in {".png", ".jpg", ".webp", ".gif"} else ""


def _guess_ext_from_content_type(ct: str) -> str:
    s = (ct or "").lower()
    if "image/png" in s:
        return ".png"
    if "image/jpeg" in s or "image/jpg" in s:
        return ".jpg"
    if "image/webp" in s:
        return ".webp"
    if "image/gif" in s:
        return ".gif"
    return ""


def _save_bytes(data: bytes, out_dir: Path, prefix: str, ext: str) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    file = out_dir / f"{prefix}-{int(time.time()*1000)}{ext or '.png'}"
    file.write_bytes(data)
    return file


def _extract_uploaded_url(payload: dict) -> str:
    candidates = [
        payload.get("url"),
        payload.get("data", {}).get("url") if isinstance(payload.get("data"), dict) else None,
        payload.get("result", {}).get("url") if isinstance(payload.get("result"), dict) else None,
        payload.get("file", {}).get("url") if isinstance(payload.get("file"), dict) else None,
    ]
    for u in candidates:
        if isinstance(u, str) and u.strip():
            return u.strip()
    raise RuntimeError(f"upload response missing url: {payload}")


def _upload_bytes_to_public(upload_url: str, upload_api_key: str, data: bytes, filename: str, timeout: int, insecure: bool) -> str:
    headers = {}
    if upload_api_key.strip():
        headers["Authorization"] = f"Bearer {upload_api_key.strip()}"
    files = {"file": (filename, data)}
    r = requests.post(upload_url, headers=headers, files=files, timeout=timeout, verify=not insecure)
    r.raise_for_status()
    try:
        body = r.json()
    except Exception:
        raise RuntimeError(f"upload non-json: HTTP {r.status_code}, body={r.text[:300]}")
    return _extract_uploaded_url(body)


def _resolve_reference_to_https(ref: str, upload_url: str, upload_api_key: str, timeout: int, insecure: bool) -> str:
    v = (ref or "").strip()
    if not v:
        return ""

    p = urlparse(v)
    # 你当前规则：http / https 都可直接透传
    if p.scheme in {"http", "https"}:
        return v

    # 本地路径：上传到公共图床（转成可公网访问 URL）
    local = Path(v)
    if not local.is_absolute():
        local = (Path.cwd() / local).resolve()
    if not local.exists() or not local.is_file():
        raise FileNotFoundError(f"参考图不存在：{local}")
    data = local.read_bytes()
    ext = local.suffix.lower() or ".png"
    if ext == ".jpeg":
        ext = ".jpg"
    if ext not in {".png", ".jpg", ".webp", ".gif"}:
        ext = ".png"
    return _upload_bytes_to_public(upload_url, upload_api_key, data, f"{local.stem}{ext}", timeout, insecure)


def _extract_first_image_item(resp_json: dict) -> dict:
    data = resp_json.get("data") if isinstance(resp_json, dict) else None
    if isinstance(data, list) and data:
        first = data[0]
        return first if isinstance(first, dict) else {}
    return {}


def _extract_remote_image_url(first_item: dict) -> str:
    image_url = str(first_item.get("url") or "").strip()
    if image_url:
        return image_url
    b64_json = first_item.get("b64_json")
    if isinstance(b64_json, str) and b64_json.strip().startswith(("http://", "https://")):
        return b64_json.strip()
    return ""


def _download_or_decode_image(first_item: dict, out_dir: Path, prefix: str, timeout: int, insecure: bool) -> Path | None:
    image_url = _extract_remote_image_url(first_item)
    b64_json = first_item.get("b64_json")

    if image_url:
        r = requests.get(image_url, timeout=timeout, verify=not insecure)
        r.raise_for_status()
        ext = _guess_ext_from_content_type(r.headers.get("content-type", "")) or _guess_ext_from_url(image_url) or ".png"
        return _save_bytes(r.content, out_dir, prefix, ext)

    if isinstance(b64_json, str) and b64_json.strip():
        raw = b64_json.strip()
        if raw.startswith("data:") and "," in raw:
            header, raw = raw.split(",", 1)
            ext = ".png"
            if "image/jpeg" in header:
                ext = ".jpg"
            elif "image/webp" in header:
                ext = ".webp"
            elif "image/gif" in header:
                ext = ".gif"
            data = base64.b64decode(raw)
            return _save_bytes(data, out_dir, prefix, ext)
        try:
            data = base64.b64decode(raw)
            return _save_bytes(data, out_dir, prefix, ".png")
        except Exception:
            return None

    return None


def main() -> int:
    args = parse_args()

    if (not args.allow_non_9x16) and (not _is_9x16(args.size)):
        print(f"参数错误：size={args.size} 不是 9:16 竖版。如需强制测试可加 --allow-non-9x16。", file=sys.stderr)
        return 2

    prompt_override = args.prompt_override.strip() or build_prompt_from_script(args.script, args.style_hint)

    refs_raw = _split_csv(args.character_image_urls)
    refs_https: list[str] = []
    for ref in refs_raw:
        try:
            refs_https.append(_resolve_reference_to_https(ref, args.upload_url, args.upload_api_key, args.timeout, args.insecure))
        except Exception as exc:
            print(f"[warn] 参考图处理失败，跳过：{ref} -> {exc}")

    image_https = ""
    if args.image_url.strip():
        try:
            image_https = _resolve_reference_to_https(args.image_url.strip(), args.upload_url, args.upload_api_key, args.timeout, args.insecure)
        except Exception as exc:
            print(f"图生图输入处理失败：{exc}", file=sys.stderr)
            return 2

    final_prompt = prompt_override
    if args.scene.strip():
        final_prompt = f"场景：{args.scene.strip()}\n{final_prompt}"
    if args.character_names.strip():
        final_prompt = f"人物：{args.character_names.strip()}\n{final_prompt}"

    image_inputs: list[str] = []
    if image_https:
        image_inputs.append(image_https)
    if refs_https:
        image_inputs.extend(refs_https)

    payload = {
        "model": args.model,
        "prompt": final_prompt,
        "size": args.size,
        "n": 1,
    }
    if image_inputs:
        payload["image"] = image_inputs

    if args.prompt_only:
        print(json.dumps({"prompt": final_prompt, "payload": payload}, ensure_ascii=False, indent=2))
        return 0

    url = args.base_url.rstrip("/") + "/v1/images/generations"
    headers = {"Content-Type": "application/json"}
    if args.token.strip():
        headers["token"] = args.token.strip()
        headers["Authorization"] = f"Bearer {args.token.strip()}"
    if args.api_key.strip():
        headers["x-api-key"] = args.api_key.strip()
        headers["Authorization"] = f"Bearer {args.api_key.strip()}"

    print(f"POST {url}")
    print("payload:")
    print(json.dumps(payload, ensure_ascii=False, indent=2))

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=args.timeout, verify=not args.insecure)
    except requests.RequestException as exc:
        print(f"请求失败: {exc}", file=sys.stderr)
        return 2

    print(f"HTTP {response.status_code}")
    try:
        data = response.json()
        print(json.dumps(data, ensure_ascii=False, indent=2))
    except ValueError:
        print(response.text)
        return 0 if response.ok else 1

    if not response.ok:
        return 1

    out_dir = Path(args.download_dir).expanduser().resolve() if args.download_dir else _default_download_dir()
    first = _extract_first_image_item(data)
    remote_url = _extract_remote_image_url(first)
    saved = _download_or_decode_image(first, out_dir, args.filename_prefix, args.timeout, args.insecure)

    result = {
        "sceneImageUrl": remote_url,
        "remoteImageUrl": remote_url,
        "localImagePath": str(saved) if saved else "",
    }
    if not remote_url and not saved:
        result["warn"] = "未能从响应中提取图片并落盘"

    print(json.dumps(result, ensure_ascii=False))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
