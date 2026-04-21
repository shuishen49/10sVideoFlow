---
name: video-generation-pic2api
description: 使用 pic2api（OpenAI 兼容）执行文生视频/图生视频，支持提交任务与轮询获取最终视频 URL。
version: 1.0.0
---

# 视频生成 Skill（pic2api）

适用场景
- 文生视频（text-to-video）
- 图生视频（image-to-video，传 image base64）

Base URL
- https://www.pic2api.com/v1

主要接口
1) 提交任务
- POST /video/generations

2) 查询任务状态
- GET /video/generations/{task_id}

支持模型
- sora2
- sora2-pro
- veo3.1
- veo3.1-fast
- veo3.1-ref

推荐参数
- size: 1024x576（横屏）/ 576x1024（竖屏）
- duration: 4 / 8 / 12

环境变量
- PIC2API_BASE_URL=https://www.pic2api.com/v1
- PIC2API_KEY=你的 key

快速用法
```bash
cd /mnt/c/Users/Administrator/.openclaw/workspace/skill/video-generation-pic2api
python3 scripts/generate_video.py \
  --prompt "雨夜城市街头，霓虹反光，电影感运镜" \
  --model sora2-pro \
  --size 1024x576 \
  --duration 8
```

输出
- 先输出 task_id
- 轮询到 completed 后输出 output.url

常见问题
- 401/403：API Key 不正确或无权限
- 长时间 processing：切换 veo3.1-fast，或延长轮询等待
- completed 但无视频地址：打印完整响应体检查字段（output.url / data.url 等）
