# video-generation-pic2api

这是一个独立文件夹版的视频生成 skill。

目录
- SKILL.md
- .env
- scripts/generate_video.py
- scripts/generate_video.sh

## 1. 配置
编辑 `.env`：

```env
PIC2API_BASE_URL=https://www.pic2api.com/v1
PIC2API_KEY=你的key
```

## 2. Python 调用（推荐）
```bash
python3 scripts/generate_video.py \
  --prompt "海浪拍打沙滩的慢动作" \
  --model sora2-pro \
  --size 1024x576 \
  --duration 8
```

## 3. Shell 调用
```bash
bash scripts/generate_video.sh "海浪拍打沙滩的慢动作" sora2-pro 1024x576 8
```

## 4. 图生视频（Python）
```bash
python3 scripts/generate_video.py \
  --prompt "黑猫记者跑向镜头，漫画风" \
  --model veo3.1-ref \
  --size 576x1024 \
  --duration 8 \
  --image ./assets/black-cat-reporter.png
```

脚本会自动提交任务并轮询，成功时输出最终视频 URL。
