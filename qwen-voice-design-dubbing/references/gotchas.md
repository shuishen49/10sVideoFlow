# Gotchas

## 已验证可用模型组合

- 声音设计：`qwen-voice-design`
- realtime TTS：`qwen3-tts-vd-realtime-2026-01-15`

## 已踩过的坑

1. `preferred_name` 非法
   - 症状：`InvalidParameter`
   - 典型报错：`Required input 'preferred_name' is invalid`
   - 处理：改成短、简单、纯英文名字，例如 `blackcat26`、`lobsterai`

2. SDK 没拿到 API key
   - 症状：`dashscope.common.error.InputRequired: apikey is required!`
   - 处理：确保 `.env` 已加载，并显式写 `dashscope.api_key = API_KEY`

3. 声音设计与后续 TTS 模型不一致
   - 症状：websocket `TaskFailed` / `ModelNotFound`
   - 典型报错：`Model not found (qwen3-tts-vd-2026-01-26)!`
   - 处理：`target_model` 和后续 realtime `model` 统一到 `qwen3-tts-vd-realtime-2026-01-15`

4. ffmpeg 拼接失败
   - 处理：逐句文件统一采样率、单声道、同格式；先拼 WAV，再转 MP3 更稳

5. 试听音频字段不固定（很常见）
   - 症状：看起来“设计成功”，但代码拿不到 preview 音频
   - 说明：返回里不一定有 preview URL，常见是 `output.preview_audio.data`（base64）
   - 处理：同时兼容 URL 与 base64 两种形态，必要时把 base64 落盘为 wav

## 建议排障顺序

1. 看音色创建是否成功
2. 看 `preview_audio` 是否已经落盘
3. 看 websocket 错误体，而不是只看 Python BrokenPipe
4. 看最终逐句文件是否都生成齐
5. 最后再看 ffmpeg 合并
