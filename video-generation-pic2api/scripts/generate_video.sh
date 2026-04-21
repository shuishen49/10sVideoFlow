#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi

PROMPT="${1:-}"
MODEL="${2:-sora2-pro}"
SIZE="${3:-1024x576}"
DURATION="${4:-8}"

if [ -z "$PROMPT" ]; then
  echo "用法: bash scripts/generate_video.sh \"提示词\" [model] [size] [duration]"
  exit 1
fi

if [ -z "${PIC2API_KEY:-}" ]; then
  echo "错误: 未设置 PIC2API_KEY（请检查 .env）"
  exit 2
fi

BASE_URL="${PIC2API_BASE_URL:-https://www.pic2api.com/v1}"

resp=$(curl -sS -X POST "$BASE_URL/video/generations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PIC2API_KEY" \
  -d "{\"model\":\"$MODEL\",\"prompt\":\"$PROMPT\",\"size\":\"$SIZE\",\"duration\":$DURATION}")

echo "$resp"

task_id=$(python3 - <<'PY' "$resp"
import json,sys
r=json.loads(sys.argv[1]) if sys.argv[1].strip() else {}
print(r.get('task_id') or r.get('id') or (r.get('data') or {}).get('task_id') or '')
PY
)

if [ -z "$task_id" ]; then
  echo "未返回 task_id，已输出提交响应。"
  exit 0
fi

echo "task_id=$task_id"
for i in $(seq 1 120); do
  s=$(curl -sS -X GET "$BASE_URL/video/generations/$task_id" -H "Authorization: Bearer $PIC2API_KEY")
  status=$(python3 - <<'PY' "$s"
import json,sys
r=json.loads(sys.argv[1]) if sys.argv[1].strip() else {}
print((r.get('status') or (r.get('data') or {}).get('status') or '').lower())
PY
)
  url=$(python3 - <<'PY' "$s"
import json,sys
r=json.loads(sys.argv[1]) if sys.argv[1].strip() else {}
out=r.get('output') or {}
data=r.get('data') or {}
print(out.get('url') or data.get('url') or r.get('url') or '')
PY
)
  echo "poll#$i status=$status"
  if [ "$status" = "completed" ] || [ "$status" = "succeeded" ] || [ "$status" = "success" ]; then
    echo "video_url=$url"
    exit 0
  fi
  if [ "$status" = "failed" ] || [ "$status" = "error" ] || [ "$status" = "cancelled" ]; then
    echo "任务失败: $s"
    exit 3
  fi
  sleep 4
done

echo "轮询超时"
exit 4
