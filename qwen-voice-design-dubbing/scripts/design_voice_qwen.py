#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
用阿里千问（DashScope）设计音色。

示例：
python design_voice_qwen.py \
  --prompt "18岁女生，中文普通话，语速稍快，甜美自然" \
  --role "黑猫记者" \
  --out-json ./voice_blackcat.json

环境变量：
- DASHSCOPE_API_KEY（必填，除非用 --api-key 传入）
- DASHSCOPE_BASE_URL（可选，默认 https://dashscope.aliyuncs.com）
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional


def load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


def sanitize_preferred_name(name: str) -> str:
    # DashScope 对 preferred_name 校验较严格，优先使用 ASCII 安全字符
    cleaned = re.sub(r"[^0-9A-Za-z_-]+", "", name or "")
    if not cleaned:
        cleaned = "voice_profile"
    if not re.match(r"^[A-Za-z_]", cleaned):
        cleaned = f"v_{cleaned}"
    return cleaned[:32]


def pick_first_string(data: Any, keys: tuple[str, ...]) -> str:
    if isinstance(data, dict):
        for k in keys:
            v = data.get(k)
            if isinstance(v, str) and v.strip():
                return v.strip()
        for v in data.values():
            found = pick_first_string(v, keys)
            if found:
                return found
    elif isinstance(data, list):
        for item in data:
            found = pick_first_string(item, keys)
            if found:
                return found
    return ""


def post_json(url: str, payload: Dict[str, Any], api_key: str, timeout: int = 120) -> Dict[str, Any]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url=url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return {
                "ok": True,
                "status": resp.getcode(),
                "data": json.loads(raw) if raw else {},
                "text": raw,
            }
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8", errors="replace")
        try:
            data = json.loads(text) if text else {}
        except Exception:
            data = {"raw": text}
        return {"ok": False, "status": e.code, "data": data, "text": text}


def main() -> int:
    parser = argparse.ArgumentParser(description="DashScope 千问音色设计")
    parser.add_argument("--prompt", required=True, help="音色描述提示词")
    parser.add_argument("--role", default="默认角色", help="角色名（用于 preferred_name）")
    parser.add_argument("--target-model", default="qwen3-tts-vd-realtime-2026-01-15", help="目标 TTS 模型")
    parser.add_argument("--model", default="qwen-voice-design", help="音色设计模型")
    parser.add_argument("--language", default="zh", help="语言，默认 zh")
    parser.add_argument("--preview-text", default="你好，我是新设计的音色，很高兴为你播报。", help="设计时必填的试听文本")
    parser.add_argument("--base-url", default=os.getenv("DASHSCOPE_BASE_URL", "https://dashscope.aliyuncs.com"), help="DashScope 基础地址")
    parser.add_argument("--api-key", default=os.getenv("DASHSCOPE_API_KEY", ""), help="DashScope API Key")
    parser.add_argument("--out-json", default="voice_profile.json", help="输出 JSON 文件路径")
    parser.add_argument("--env-file", default="", help="可选 .env 路径（会在读取环境变量前加载）")
    args = parser.parse_args()

    if args.env_file:
        load_env_file(Path(args.env_file).expanduser())
        if not args.api_key:
            args.api_key = os.getenv("DASHSCOPE_API_KEY", "")

    api_key = (args.api_key or "").strip()
    if not api_key:
        print("[ERROR] 缺少 API Key。请设置 DASHSCOPE_API_KEY 或使用 --api-key", file=sys.stderr)
        return 2

    base_url = str(args.base_url).rstrip("/")
    url = f"{base_url}/api/v1/services/audio/tts/customization"

    payload: Dict[str, Any] = {
        "model": args.model,
        "input": {
            "action": "create",
            "target_model": args.target_model,
            "voice_prompt": args.prompt,
            "preview_text": args.preview_text,
            "preferred_name": sanitize_preferred_name(args.role),
            "language": args.language,
        },
    }

    result = post_json(url, payload, api_key)
    if not result.get("ok"):
        print(json.dumps({
            "ok": False,
            "status": result.get("status"),
            "error": result.get("data") or result.get("text"),
            "request_url": url,
            "request_payload": payload,
        }, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1

    data = result.get("data") or {}
    voice_id = pick_first_string(data, ("voice", "voice_id", "voiceId"))
    preview_audio = pick_first_string(data, ("preview_audio", "previewAudio", "audio_url", "audioUrl", "url"))
    # 兼容 output.preview_audio.data(base64 wav) 场景
    if not preview_audio and isinstance(data, dict):
        out_obj = data.get("output") if isinstance(data.get("output"), dict) else {}
        pa = out_obj.get("preview_audio") if isinstance(out_obj.get("preview_audio"), dict) else {}
        b64 = str(pa.get("data") or "").strip()
        fmt = str(pa.get("response_format") or "wav").strip().lower() or "wav"
        if b64:
            preview_audio = f"data:audio/{fmt};base64,{b64}"

    out = {
        "ok": True,
        "provider": "dashscope",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "request": payload,
        "response": data,
        "voice_id": voice_id,
        "preview_audio": preview_audio,
        "base_url": base_url,
    }

    out_path = Path(args.out_json).expanduser()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps({
        "ok": True,
        "voice_id": voice_id,
        "preview_audio": preview_audio,
        "out_json": str(out_path),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
