#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
官方 SDK 版 TTS（Qwen Realtime），不使用手写 HTTP。

说明：
- 按阿里云 Model Studio「Text-to-Speech」SDK 思路，使用 dashscope 官方 SDK。
- 对 qwen3-tts-vd-realtime-* 模型，使用 QwenTtsRealtime WebSocket SDK。
- 输出默认 WAV（由 SDK 回传的 PCM16 数据封装成 wav）。

示例：
python3 tts_with_designed_voice_qwen.py \
  --voice-json ./voice_blackcat.json \
  --text "各位观众大家好，这里是黑猫记者现场报道。" \
  --model qwen3-tts-vd-realtime-2026-01-15 \
  --out-audio ./blackcat_demo.wav \
  --api-key "$DASHSCOPE_API_KEY"

依赖：
  python3 -m pip install --user dashscope --break-system-packages
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
import wave
from pathlib import Path
from typing import Any

try:
    import dashscope
    from dashscope.audio.qwen_tts_realtime import (
        AudioFormat,
        QwenTtsRealtime,
        QwenTtsRealtimeCallback,
    )
except Exception as e:  # pragma: no cover
    print(
        json.dumps(
            {
                "ok": False,
                "error": "missing_dependency",
                "message": f"缺少 dashscope SDK：{e}",
                "hint": "先执行: python3 -m pip install --user dashscope --break-system-packages",
            },
            ensure_ascii=False,
            indent=2,
        ),
        file=sys.stderr,
    )
    raise SystemExit(2)


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


def load_voice_id(voice_id: str, voice_json: str) -> str:
    if voice_id and voice_id.strip():
        return voice_id.strip()
    if not voice_json:
        return ""
    p = Path(voice_json).expanduser()
    if not p.exists():
        return ""
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return ""
    return pick_first_string(data, ("voice_id", "voice", "voiceId"))


class RealtimeCollector(QwenTtsRealtimeCallback):
    def __init__(self) -> None:
        super().__init__()
        self.chunks: list[bytes] = []
        self.errors: list[dict] = []
        self.done = False
        self.session_id = None
        self.response_id = None

    def on_event(self, message):
        obj = message if isinstance(message, dict) else {}
        t = obj.get("type")

        if t == "session.created":
            self.session_id = (obj.get("session") or {}).get("id")
        elif t == "response.created":
            self.response_id = (obj.get("response") or {}).get("id")
        elif t == "response.audio.delta":
            d = obj.get("delta")
            if d:
                self.chunks.append(base64.b64decode(d))
        elif t in ("response.audio.done", "response.done"):
            self.done = True
        elif t == "error":
            self.errors.append(obj)
            self.done = True


def synthesize_pcm_via_sdk(api_key: str, model: str, voice_id: str, text: str, timeout_s: int = 30):
    dashscope.api_key = api_key

    cb = RealtimeCollector()
    rt = QwenTtsRealtime(model=model, callback=cb)
    rt.connect()
    try:
        rt.update_session(
            voice=voice_id,
            response_format=AudioFormat.PCM_24000HZ_MONO_16BIT,
        )
        rt.append_text(text)
        rt.commit()

        end_at = time.time() + timeout_s
        while time.time() < end_at and not cb.done:
            time.sleep(0.1)

        rt.finish()
        time.sleep(0.2)

    finally:
        rt.close()

    if cb.errors:
        err = cb.errors[0]
        raise RuntimeError(f"Realtime TTS error: {json.dumps(err, ensure_ascii=False)}")

    pcm = b"".join(cb.chunks)
    if not pcm:
        raise RuntimeError("Realtime TTS 返回为空（无音频数据）")

    return {
        "pcm": pcm,
        "session_id": cb.session_id,
        "response_id": cb.response_id,
    }


def write_wav_from_pcm(pcm_bytes: bytes, out_path: Path, sample_rate: int = 24000) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(out_path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16bit
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_bytes)


def main() -> int:
    parser = argparse.ArgumentParser(description="DashScope 官方 SDK 版 TTS（Qwen Realtime）")
    parser.add_argument("--voice-id", default="", help="设计后的 voice id")
    parser.add_argument("--voice-json", default="", help="design_voice_qwen.py 输出 json（自动提取 voice_id）")
    parser.add_argument("--text", required=True, help="要朗读的文本")
    parser.add_argument("--model", default="qwen3-tts-vd-realtime-2026-01-15", help="TTS 模型")
    parser.add_argument("--out-audio", default="tts_output.wav", help="输出音频路径")
    parser.add_argument("--sample-rate", default=24000, type=int, help="采样率（当前固定走 24k PCM）")
    parser.add_argument("--api-key", default=os.getenv("DASHSCOPE_API_KEY", ""), help="DashScope API Key")
    parser.add_argument("--env-file", default="", help="可选 .env 路径")
    args = parser.parse_args()

    if args.env_file:
        load_env_file(Path(args.env_file).expanduser())
        if not args.api_key:
            args.api_key = os.getenv("DASHSCOPE_API_KEY", "")

    api_key = (args.api_key or "").strip()
    if not api_key:
        print("[ERROR] 缺少 API Key。请设置 DASHSCOPE_API_KEY 或使用 --api-key", file=sys.stderr)
        return 2

    voice_id = load_voice_id(args.voice_id, args.voice_json)
    if not voice_id:
        print("[ERROR] 缺少 voice_id。请传 --voice-id 或 --voice-json", file=sys.stderr)
        return 2

    out_path = Path(args.out_audio).expanduser()

    try:
        res = synthesize_pcm_via_sdk(
            api_key=api_key,
            model=args.model,
            voice_id=voice_id,
            text=args.text,
            timeout_s=40,
        )
        write_wav_from_pcm(res["pcm"], out_path, sample_rate=args.sample_rate)
    except Exception as e:
        print(
            json.dumps(
                {
                    "ok": False,
                    "phase": "sdk_call",
                    "message": str(e),
                    "model": args.model,
                    "voice_id": voice_id,
                },
                ensure_ascii=False,
                indent=2,
            ),
            file=sys.stderr,
        )
        return 1

    print(
        json.dumps(
            {
                "ok": True,
                "mode": "dashscope_sdk_qwen_tts_realtime",
                "out_audio": str(out_path),
                "bytes": len(res["pcm"]),
                "voice_id": voice_id,
                "model": args.model,
                "session_id": res.get("session_id"),
                "response_id": res.get("response_id"),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
