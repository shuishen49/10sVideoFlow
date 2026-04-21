#!/usr/bin/env python3
"""调用 /api/v1/short-drama/generate-character-image 接口。"""

from __future__ import annotations

import argparse
import base64
import json
import sys

import requests

# 强制 UTF-8 输出，避免 Windows 控制台/子进程采集时中文乱码
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

SIZE_MAP = {
    "16:9": "1792*1024",
    "9:16": "1024*1792",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="调用短剧角色文生图接口，便于写 skill 时快速验证。"
    )
    parser.add_argument(
        "--base-url",
        default="https://uuerqapsftez.sealosgzg.site/",
        help="服务地址（不含接口路径），默认 https://uuerqapsftez.sealosgzg.site/", 
    )
    parser.add_argument("--token", default="", help="用户登录 token")
    parser.add_argument("--api-key", default="", help="服务 API Key（可替代 token）")
    parser.add_argument("--prompt", required=True, help="人物描述提示词（建议英文）")
    parser.add_argument("--character-name", default="", help="角色名")
    parser.add_argument(
        "--size",
        default="16:9",
        choices=["16:9", "9:16"],
        help="画幅比例，仅支持 16:9 或 9:16",
    )
    parser.add_argument("--timeout", type=int, default=120, help="请求超时时间（秒）")
    parser.add_argument(
        "--insecure",
        action="store_true",
        help="跳过 TLS 证书校验（仅调试时使用）",
    )
    return parser.parse_args()


def maybe_b64_decode(v: str) -> str:
    s = (v or "").strip()
    if not s:
        return s
    # bridge 侧已统一用 base64 传参，脚本侧先尝试解码，失败则原样返回
    try:
        return base64.b64decode(s).decode("utf-8")
    except Exception:
        return s


def main() -> int:
    args = parse_args()

    if not args.token.strip() and not args.api_key.strip():
        print("缺少 --token 或 --api-key", file=sys.stderr)
        return 2

    prompt_text = maybe_b64_decode(args.prompt)
    character_name = maybe_b64_decode(args.character_name)

    url = args.base_url.rstrip("/") + "/api/v1/short-drama/generate-character-image"
    headers = {
        "Content-Type": "application/json",
    }
    if args.token.strip():
        headers["token"] = args.token.strip()
        headers["Authorization"] = f"Bearer {args.token.strip()}"
    if args.api_key.strip():
        headers["Authorization"] = f"Bearer {args.api_key.strip()}"
    payload = {
        "prompt": prompt_text,
        "character_name": character_name,
        "size": SIZE_MAP[args.size],
        "model": "gpt-5.2",
    }

    print(f"POST {url}")
    print("payload:")
    print(json.dumps(payload, ensure_ascii=False, indent=2))

    try:
        response = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=args.timeout,
            verify=not args.insecure,
        )
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


if __name__ == "__main__":
    raise SystemExit(main())
