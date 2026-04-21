#!/usr/bin/env python3
"""调用 Grok 视频接口（不使用 sso）。"""

from __future__ import annotations

import argparse
import json
import sys

import requests


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="调用 Grok 视频生成接口，便于 skill 联调。")
    parser.add_argument(
        "--base-url",
        default="https://uuerqapsftez.sealosgzg.site/",
        help="服务地址（不含接口路径），默认 https://uuerqapsftez.sealosgzg.site/", 
    )
    parser.add_argument("--token", default="", help="平台登录 token（用于 /api/v1/user-video/create）")
    parser.add_argument("--api-key", default="", help="平台 API Key（用于 /api/v1/grok/chat/completions）")
    parser.add_argument("--prompt", required=True, help="视频描述提示词")
    parser.add_argument("--image-url", default="", help="可选：图片 URL，传入即图生视频")
    parser.add_argument(
        "--image-urls",
        default="",
        help="可选：多图 URL，逗号分隔（优先级高于 --image-url）",
    )
    parser.add_argument(
        "--aspect-ratio",
        default="16:9",
        choices=["16:9", "9:16", "1:1"],
        help="画幅比例",
    )
    parser.add_argument("--video-length", type=int, default=6, choices=[6, 10], help="视频时长（秒）")
    parser.add_argument("--resolution", default="480p", help="分辨率，如 480p")
    parser.add_argument("--preset", default="custom", help="预设")
    parser.add_argument("--no-upscale", action="store_true", help="关闭高清增强")
    parser.add_argument("--timeout", type=int, default=180, help="请求超时时间（秒）")
    parser.add_argument("--insecure", action="store_true", help="跳过 TLS 证书校验（仅调试）")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    use_api_key_mode = bool(args.api_key.strip())

    if use_api_key_mode:
        url = args.base_url.rstrip("/") + "/api/v1/grok/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {args.api_key.strip()}",
        }
        payload = {
            "model": "grok-imagine-1.0-video",
            "messages": [{"role": "user", "content": args.prompt}],
            "video_config": {
                "aspect_ratio": args.aspect_ratio,
                "video_length": args.video_length,
                "resolution_name": args.resolution,
                "preset": args.preset,
                "upscale": not args.no_upscale,
            },
            "stream": False,
        }
    else:
        if not args.token.strip():
            print("缺少 --token（调用 /api/v1/user-video/create 需要）", file=sys.stderr)
            return 2

        url = args.base_url.rstrip("/") + "/api/v1/user-video/create"
        headers = {
            "Content-Type": "application/json",
            "token": args.token.strip(),
        }
        orientation = "landscape" if args.aspect_ratio == "16:9" else ("portrait" if args.aspect_ratio == "9:16" else "square")
        n_frames = 300 if args.video_length == 10 else 180
        payload = {
            "prompt": args.prompt,
            "model": "gork",
            "orientation": orientation,
            "n_frames": n_frames,
        }

    raw_multi = [u.strip() for u in args.image_urls.split(",") if u.strip()]
    if raw_multi:
        if len(raw_multi) == 1:
            payload["image_url"] = raw_multi[0]
        else:
            payload["image_urls"] = raw_multi[:7]
    elif args.image_url.strip():
        payload["image_url"] = args.image_url.strip()

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
