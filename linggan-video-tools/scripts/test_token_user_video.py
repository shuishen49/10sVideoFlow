#!/usr/bin/env python3
"""测试 token 是否可用：调用 /api/v1/base/userinfo。"""

from __future__ import annotations

import argparse
import json
import sys

import requests


DEFAULT_TOKEN = ""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="测试 base/userinfo 接口 token")
    parser.add_argument(
        "--base-url",
        default="https://uuerqapsftez.sealosgzg.site/",
        help="服务地址（不含接口路径），默认 https://uuerqapsftez.sealosgzg.site/", 
    )
    parser.add_argument(
        "--token",
        default=DEFAULT_TOKEN,
        help="登录 token",
    )
    parser.add_argument("--api-key", default="", help="服务 API Key（可替代 token）")
    parser.add_argument("--timeout", type=int, default=30, help="请求超时秒数")
    parser.add_argument("--insecure", action="store_true", help="跳过 TLS 校验（仅调试）")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.token.strip() and not args.api_key.strip():
        print("缺少 --token 或 --api-key", file=sys.stderr)
        return 2
    url = args.base_url.rstrip("/") + "/api/v1/base/userinfo"
    headers = {}
    if args.token.strip():
        headers["token"] = args.token.strip()
        headers["Authorization"] = f"Bearer {args.token.strip()}"
    if args.api_key.strip():
        headers["Authorization"] = f"Bearer {args.api_key.strip()}"

    print(f"GET {url}")
    try:
        response = requests.get(url, headers=headers, timeout=args.timeout, verify=not args.insecure)
    except requests.RequestException as exc:
        print(f"请求失败: {exc}", file=sys.stderr)
        return 2

    print(f"HTTP {response.status_code}")
    try:
        data = response.json()
        print(json.dumps(data, ensure_ascii=False, indent=2))
        if response.status_code == 200 and str(data.get("code", "")) == "200":
            print("\nTOKEN_OK")
            return 0
        print("\nTOKEN_INVALID_OR_DENIED")
        return 1
    except ValueError:
        print(response.text)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
