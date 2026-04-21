#!/usr/bin/env python3
import argparse
import base64
import json
import os
import ssl
import subprocess
import sys
import time
from pathlib import Path
from urllib import request, error


def load_dotenv(path: Path):
    if not path.exists():
        return
    for line in path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())


def http_json(method: str, url: str, api_key: str, payload=None, timeout=120, ssl_ctx=None):
    data = None
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': os.getenv('PIC2API_USER_AGENT', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'),
    }
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    req = request.Request(url=url, method=method.upper(), data=data, headers=headers)
    try:
        with request.urlopen(req, timeout=timeout, context=ssl_ctx) as resp:
            text = resp.read().decode('utf-8', errors='replace')
            return resp.getcode(), json.loads(text) if text else {}
    except error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {'error': {'message': body or str(e)}}


def build_ssl_context(insecure: bool):
    if insecure:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx
    return ssl.create_default_context()


def request_with_retry(method: str, url: str, api_key: str, ssl_ctx, retries: int, backoff: float, payload=None, timeout=120):
    attempt = 0
    wait_sec = 1.0
    last_err = None
    while attempt <= max(0, retries):
        try:
            return http_json(method, url, api_key, payload=payload, timeout=timeout, ssl_ctx=ssl_ctx)
        except error.URLError as e:
            last_err = e
            reason = str(getattr(e, 'reason', e))
            if attempt >= retries:
                raise
            print(f'network_retry method={method} attempt={attempt + 1}/{retries + 1} reason={reason}', file=sys.stderr)
            time.sleep(wait_sec)
            wait_sec *= max(1.1, backoff)
            attempt += 1
    if last_err:
        raise last_err
    raise RuntimeError('unexpected retry flow')


def image_size(path: str):
    p = Path(path)
    b = p.read_bytes()
    # PNG
    if b[:8] == b'\x89PNG\r\n\x1a\n' and len(b) >= 24:
        w = int.from_bytes(b[16:20], 'big')
        h = int.from_bytes(b[20:24], 'big')
        return w, h
    # JPEG (scan SOF markers)
    if len(b) >= 4 and b[0] == 0xFF and b[1] == 0xD8:
        i = 2
        while i + 9 < len(b):
            if b[i] != 0xFF:
                i += 1
                continue
            marker = b[i + 1]
            i += 2
            if marker in (0xD8, 0xD9):
                continue
            if i + 2 > len(b):
                break
            seg_len = int.from_bytes(b[i:i + 2], 'big')
            if seg_len < 2 or i + seg_len > len(b):
                break
            if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                if i + 7 <= len(b):
                    h = int.from_bytes(b[i + 3:i + 5], 'big')
                    w = int.from_bytes(b[i + 5:i + 7], 'big')
                    return w, h
                break
            i += seg_len
    return None


def read_image_as_base64(path: str) -> str:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f'图片不存在: {path}')
    return base64.b64encode(p.read_bytes()).decode('utf-8')


def windows_to_wsl_path(p: str) -> str:
    if len(p) >= 3 and p[1] == ':' and (p[2] == '\\' or p[2] == '/'):
        drive = p[0].lower()
        rest = p[2:].replace('\\', '/')
        return f'/mnt/{drive}{rest}'
    return p


def ensure_image_size(path: str, target_w: int, target_h: int) -> str:
    wh = image_size(path)
    if wh and wh[0] == target_w and wh[1] == target_h:
        return path

    src = Path(path)
    out = src.with_name(f'{src.stem}-resized-{target_w}x{target_h}{src.suffix}')

    ffmpeg = os.getenv('FFMPEG_BIN', 'ffmpeg')
    cmd = [
        ffmpeg,
        '-y',
        '-i',
        str(src),
        '-vf',
        f'scale={target_w}:{target_h}:force_original_aspect_ratio=increase,crop={target_w}:{target_h}',
        str(out),
    ]

    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        return str(out)
    except FileNotFoundError:
        pass
    except subprocess.CalledProcessError as e:
        err_text = (e.stderr or b'').decode('utf-8', errors='replace')
        raise RuntimeError(f'ffmpeg 调整图片尺寸失败: {err_text}')

    # Fallback: call WSL ffmpeg when running under Windows python
    wsl_exe = os.getenv('WSL_EXE', r'C:\Windows\System32\wsl.exe')
    wsl_cmd = [
        wsl_exe,
        '-e',
        'ffmpeg',
        '-y',
        '-i',
        windows_to_wsl_path(str(src)),
        '-vf',
        f'scale={target_w}:{target_h}:force_original_aspect_ratio=increase,crop={target_w}:{target_h}',
        windows_to_wsl_path(str(out)),
    ]
    try:
        subprocess.run(wsl_cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except subprocess.CalledProcessError as e:
        err_text = (e.stderr or b'').decode('utf-8', errors='replace')
        raise RuntimeError(f'wsl ffmpeg 调整图片尺寸失败: {err_text}')
    except FileNotFoundError:
        raise RuntimeError('未找到 ffmpeg（含 WSL 回退），可设置 FFMPEG_BIN 指向 ffmpeg 可执行文件')

    return str(out)


def parse_size(size_text: str):
    s = (size_text or '').lower().strip()
    if 'x' not in s:
        return None
    w, h = s.split('x', 1)
    if not (w.isdigit() and h.isdigit()):
        return None
    return int(w), int(h)


def pick_video_url(resp: dict) -> str:
    if not isinstance(resp, dict):
        return ''
    out = resp.get('output')
    if isinstance(out, dict) and out.get('url'):
        return str(out.get('url'))
    data = resp.get('data')
    if isinstance(data, dict):
        for k in ('url', 'video_url', 'play_url', 'local_url', 'hd_video_url'):
            if data.get(k):
                return str(data.get(k))
    for k in ('url', 'video_url', 'play_url', 'local_url', 'hdVideoUrl'):
        if resp.get(k):
            return str(resp.get(k))
    return ''


def main():
    parser = argparse.ArgumentParser(description='pic2api 视频生成（提交+轮询）')
    parser.add_argument('--prompt', required=True, help='视频提示词')
    parser.add_argument('--model', default='sora2-pro', help='sora2/sora2-pro/veo3.1/veo3.1-fast/veo3.1-ref')
    parser.add_argument('--size', default='1024x576', help='1024x576 或 576x1024')
    parser.add_argument('--duration', type=int, default=8, choices=[4, 8, 12], help='时长秒数')
    parser.add_argument('--image', default='', help='图生视频首帧图片路径（可选）')
    parser.add_argument('--image-tail', default='', help='图生视频尾帧图片路径（可选）')
    parser.add_argument('--auto-size-from-image', action='store_true', help='图生视频时自动读取首帧尺寸并覆盖 --size')
    parser.add_argument('--interval', type=int, default=4, help='轮询间隔秒数')
    parser.add_argument('--timeout', type=int, default=480, help='最大等待秒数')
    parser.add_argument('--submit-retries', type=int, default=3, help='提交阶段重试次数（网络抖动重试）')
    parser.add_argument('--poll-retries', type=int, default=2, help='轮询阶段单次请求重试次数（网络抖动重试）')
    parser.add_argument('--retry-backoff', type=float, default=1.8, help='重试退避系数（指数退避）')
    parser.add_argument('--insecure', action='store_true', help='禁用 TLS 证书校验（仅排障使用）')
    args = parser.parse_args()

    load_dotenv(Path(__file__).resolve().parents[1] / '.env')
    base_url = os.getenv('PIC2API_BASE_URL', 'https://www.pic2api.com/v1').rstrip('/')
    api_key = os.getenv('PIC2API_KEY', '').strip()

    if not api_key:
        print('错误: 未找到 PIC2API_KEY，请先配置 .env', file=sys.stderr)
        sys.exit(2)

    effective_size = args.size
    effective_image = args.image

    if args.image and args.auto_size_from_image:
        wh = image_size(args.image)
        if wh:
            effective_size = f'{wh[0]}x{wh[1]}'
            print(f'auto_size_from_image= {effective_size}')
        else:
            print('warn: 无法读取图片尺寸，继续使用 --size', file=sys.stderr)

    size_wh = parse_size(effective_size)
    if args.image and size_wh:
        try:
            adjusted = ensure_image_size(args.image, size_wh[0], size_wh[1])
            if adjusted != args.image:
                print(f'image_resized= {adjusted}')
                effective_image = adjusted
        except Exception as e:
            print(f'warn: 图片尺寸预处理失败，继续使用原图: {e}', file=sys.stderr)

    payload = {
        'model': args.model,
        'prompt': args.prompt,
        'size': effective_size,
        'duration': args.duration,
    }
    if effective_image:
        payload['image'] = read_image_as_base64(effective_image)
    if args.image_tail:
        payload['image_tail'] = read_image_as_base64(args.image_tail)

    ssl_ctx = build_ssl_context(args.insecure)

    submit_url = f'{base_url}/video/generations'
    try:
        code, submit_resp = request_with_retry(
            'POST',
            submit_url,
            api_key,
            ssl_ctx=ssl_ctx,
            retries=args.submit_retries,
            backoff=args.retry_backoff,
            payload=payload,
            timeout=120,
        )
    except error.URLError as e:
        print(f'提交失败: 网络连接异常: {e}', file=sys.stderr)
        print('建议: 1) 重试 2) 检查公司代理/防火墙 3) 临时加 --insecure 排障', file=sys.stderr)
        sys.exit(1)

    if code < 200 or code >= 300:
        print('提交失败:', json.dumps(submit_resp, ensure_ascii=False, indent=2), file=sys.stderr)
        sys.exit(1)

    task_id = str(
        submit_resp.get('task_id')
        or submit_resp.get('id')
        or (submit_resp.get('data') or {}).get('task_id')
        or ''
    )
    print('submit_ok')
    print('task_id=', task_id)
    print('submit_response=', json.dumps(submit_resp, ensure_ascii=False))

    if not task_id:
        url = pick_video_url(submit_resp)
        if url:
            print('status=completed')
            print('video_url=', url)
            return
        print('警告: 未返回 task_id，无法轮询。')
        return

    status_url = f'{base_url}/video/generations/{task_id}'
    start = time.time()

    while True:
        try:
            code, stat_resp = request_with_retry(
                'GET',
                status_url,
                api_key,
                ssl_ctx=ssl_ctx,
                retries=args.poll_retries,
                backoff=args.retry_backoff,
                payload=None,
                timeout=120,
            )
        except error.URLError as e:
            print(f'查询失败: 网络连接异常: {e}', file=sys.stderr)
            sys.exit(1)

        if code < 200 or code >= 300:
            print('查询失败:', json.dumps(stat_resp, ensure_ascii=False), file=sys.stderr)
            sys.exit(1)

        status = str(
            stat_resp.get('status')
            or (stat_resp.get('data') or {}).get('status')
            or ''
        ).lower()
        url = pick_video_url(stat_resp)

        print('poll_status=', status or 'unknown')
        if status in ('completed', 'succeeded', 'success') and url:
            print('status=completed')
            print('video_url=', url)
            return
        if status in ('failed', 'error', 'cancelled'):
            print('status=failed')
            print('detail=', json.dumps(stat_resp, ensure_ascii=False))
            sys.exit(1)

        if time.time() - start > args.timeout:
            print('status=timeout')
            print('last_response=', json.dumps(stat_resp, ensure_ascii=False))
            sys.exit(3)

        time.sleep(max(1, args.interval))


if __name__ == '__main__':
    main()
