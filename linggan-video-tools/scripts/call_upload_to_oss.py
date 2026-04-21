#!/usr/bin/env python3
"""上传本地图片到公共图床（替代原 OSS 上传）。

默认上传端点：
- https://imageproxy.zhongzhuan.chat/api/upload

兼容说明：
- 保留了旧参数 --base-url / --token / --public / --account（但不再参与请求）
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import requests


DEFAULT_UPLOAD_URL = "https://imageproxy.zhongzhuan.chat/api/upload"


def _extract_uploaded_url(payload: dict) -> str:
    candidates = [
        payload.get("url"),
        payload.get("data", {}).get("url") if isinstance(payload.get("data"), dict) else None,
        payload.get("result", {}).get("url") if isinstance(payload.get("result"), dict) else None,
        payload.get("file", {}).get("url") if isinstance(payload.get("file"), dict) else None,
    ]
    for url in candidates:
        if isinstance(url, str) and url.strip():
            return url.strip()
    raise RuntimeError(f"upload response missing url: {payload}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="上传本地文件到公共图床（推荐用于避免临时 URL 过期）。")

    # 新参数
    parser.add_argument(
        "--upload-url",
        default=os.getenv("OPENAI_IMAGES_UPLOAD_URL", DEFAULT_UPLOAD_URL),
        help=f"上传端点（默认 {DEFAULT_UPLOAD_URL}）",
    )
    parser.add_argument(
        "--api-key",
        default=os.getenv("OPENAI_IMAGES_API_KEY", ""),
        help="上传服务 API Key（Bearer）",
    )
    parser.add_argument("--file", required=True, help="本地文件路径")
    parser.add_argument("--timeout", type=int, default=120, help="请求超时秒数")
    parser.add_argument("--insecure", action="store_true", help="跳过 TLS 校验（仅调试）")

    # 兼容旧参数（忽略）
    parser.add_argument("--base-url", default="", help="兼容旧参数：已忽略")
    parser.add_argument("--token", default="", help="兼容旧参数：已忽略")
    parser.add_argument("--public", action="store_true", help="兼容旧参数：已忽略")
    parser.add_argument("--account", default="", help="兼容旧参数：已忽略")

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    file_path = Path(args.file).expanduser().resolve()
    if not file_path.exists() or not file_path.is_file():
        print(f"文件不存在: {file_path}", file=sys.stderr)
        return 2

    url = args.upload_url.strip() or DEFAULT_UPLOAD_URL

    headers: dict[str, str] = {}
    if args.api_key.strip():
        headers["Authorization"] = f"Bearer {args.api_key.strip()}"

    print(f"POST {url}")
    print(f"file={file_path}")

    try:
        with file_path.open("rb") as f:
            files = {"file": (file_path.name, f)}
            response = requests.post(
                url,
                headers=headers,
                files=files,
                timeout=args.timeout,
                verify=not args.insecure,
            )
    except requests.RequestException as exc:
        print(f"请求失败: {exc}", file=sys.stderr)
        return 2

    print(f"HTTP {response.status_code}")
    try:
        body = response.json()
    except ValueError:
        body = {"raw": response.text}

    out = {
        "ok": response.ok,
        "status": response.status_code,
        "uploadUrl": url,
        "file": str(file_path),
        "response": body,
    }

    if response.ok:
        try:
            out["url"] = _extract_uploaded_url(body if isinstance(body, dict) else {})
        except Exception as exc:
            out["warn"] = str(exc)

    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0 if response.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
