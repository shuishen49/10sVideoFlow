---
name: qwen-voice-design-dubbing
description: 使用阿里百炼 DashScope 的 qwen-voice-design + qwen_tts_realtime，完成“先设计音色，再按对白逐句配音，再合成总音频”的稳定流程（含 .env、SDK、ffmpeg、排障）。
---

# Qwen Voice Design Dubbing

这个技能用于把“角色设定 + 对白脚本”跑成一套可交付音频成品。

适用场景：
- 需要先给角色设计专属音色（qwen-voice-design）
- 再用设计出的 voice 逐句合成对白（qwen3-tts-vd-realtime-2026-01-15）
- 最后得到逐句 wav + 合并总 wav/mp3 + meta.json

不适用：
- 只做一次性单句 TTS
- 不需要自定义音色
- 不用 DashScope

## 目录结构

- `scripts/design_voice_qwen.py`
  - 只做“音色设计”，输出 voice json（含 voice_id / preview_audio）
- `scripts/tts_with_designed_voice_qwen.py`
  - 使用已有 voice_id 做单句 TTS（SDK realtime）
- `scripts/run_qwen_voice_design_dub.py`
  - 一键跑完整链路：设计音色 -> 逐句配音 -> ffmpeg 合并
- `references/gotchas.md`
  - 常见报错与处理方式

## 关键结论（必须遵守）

1) 模型必须成对匹配：
- 声音设计模型：`qwen-voice-design`
- 逐句 TTS 模型：`qwen3-tts-vd-realtime-2026-01-15`

2) `preferred_name` 必须安全：
- 用短、简单、ASCII 名称（如 `blackcat26`）
- 避免中文、空格、特殊符号

3) API Key 必须从 `.env` 读取并注入 SDK：
- `.env` 放在技能根目录
- 至少包含：`DASHSCOPE_API_KEY=xxxx`

4) 兼容 preview 音频两种返回：
- `output.preview_audio.url`
- `output.preview_audio.data`（base64）

## 快速开始

1) 在技能根目录写 `.env`

```
DASHSCOPE_API_KEY=你的key
# 可选
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com
```

2) 仅设计音色

```
python3 scripts/design_voice_qwen.py \
  --prompt "26岁年轻女生音色，带轻微台湾腔，机灵自然" \
  --role "黑猫记者" \
  --out-json ./voice_blackcat.json
```

3) 用设计音色做单句试听

```
python3 scripts/tts_with_designed_voice_qwen.py \
  --voice-json ./voice_blackcat.json \
  --text "各位观众大家好，这里是黑猫记者现场报道。" \
  --out-audio ./voice_blackcat_tts.wav
```

4) 跑完整多角色对白链路

```
python3 scripts/run_qwen_voice_design_dub.py \
  --project ./demo_project \
  --out ./demo_project/outputs/voice/route-a \
  --script-json ./script_lines.json \
  --voice-prompts-json ./voice_prompts.json
```

说明：
- `script_lines.json` 格式：`[["黑猫记者","台词1"],["小龙虾","台词2"]]`
- `voice_prompts.json` 格式：
  - key 为角色名
  - value 至少包含 `preferred_name`、`voice_prompt`、`preview_text`

## 语法校验（提交前必须）

```
python3 -m py_compile scripts/design_voice_qwen.py
python3 -m py_compile scripts/tts_with_designed_voice_qwen.py
python3 -m py_compile scripts/run_qwen_voice_design_dub.py
```

## 常见坑

见 `references/gotchas.md`。

最常见的是：
- API key 没读到
- 设计模型和 TTS 模型不一致
- preferred_name 非法
- ffmpeg 拼接失败（采样率/声道/格式不统一）

## 对用户汇报建议

只汇报三件事：
- 是否完成
- 卡在哪一步
- 成品路径
