---
name: grok-storyboard-preview
description: 本地分镜预览页（zhihe-storyboard-preview-flashback.html）的启动、排障、右侧聊天 bridge 维护与文案导出技能。用户提到“预览页打不开/12731 端口/flashback 预览链接/右侧龙虾聊天/要整段文案/要看某个 project 分镜”时使用。
---

# Grok Storyboard Preview

用于维护并使用本地分镜预览页：
- 技能内自带页面文件：`assets/zhihe-storyboard-preview-flashback.html`
- 预览页启动脚本：`start-local-preview.bat`
- 聊天 bridge 服务：`bridge-server.js`
- bridge 配置：`bridge-config.json`
- bridge 启动脚本：`start-chat-bridge.bat`
- 项目内原始页面文件：`projects/grok-drama/zhihe-storyboard-preview-flashback.html`
- 常见链接：`http://127.0.0.1:12731/zhihe-storyboard-preview-flashback.html?project=<projectId>`
- 说明：预览页与本地聊天 bridge 现在都归这个 skill 一起维护；分享 skill 时，优先整包分发。

## 1) 快速启动

优先用 skill 自带脚本：

- 预览页：`start-local-preview.bat`
- 聊天 bridge：`start-chat-bridge.bat`

默认端口：
- 预览页静态服务：`12731`
- 聊天 bridge：`12732`

建议顺序：
1. 先启动 `start-chat-bridge.bat`
2. 再启动 `start-local-preview.bat`
3. 打开：`http://127.0.0.1:12731/zhihe-storyboard-preview-flashback.html?project=<projectId>`

## 2) 打不开 / 聊天不通时的排障顺序

按顺序做：
1. 检查 12731 是否监听（预览页）
2. 检查 12732 是否监听（聊天 bridge）
3. 请求 `http://127.0.0.1:12731/zhihe-storyboard-preview-flashback.html?project=<projectId>` 看页面是否可达
4. 请求 `http://127.0.0.1:12732/health` 看 bridge 是否可达
5. 再检查本机 OpenClaw Gateway：
   - `http://127.0.0.1:18789/healthz`
   - `http://127.0.0.1:18789/readyz`
6. 优先确认 skill 内文件存在：
   - `assets/zhihe-storyboard-preview-flashback.html`
   - `bridge-server.js`
   - `bridge-config.json`
7. 若 bridge 活着但聊天报错，优先检查 `bridge-config.json` 的：
   - `mode`
   - `gatewayBase`
   - `defaultSessionKey`
   - `defaultModel`
   - `openclawAdapter`
8. 若页面旧内容不刷新，按 `Ctrl+F5` 强刷；必要时重启 `start-local-preview.bat`
9. 若 12732 已有旧 bridge 实例，`start-chat-bridge.bat` 现在会先尝试结束旧进程再重启，确保加载到最新代码；若仍报 `EADDRINUSE`，再手动检查占用进程。

## 3) 用户要“整体文案”时

优先读取：
- `<project>/input/script.txt`
- `<project>/planning/segments-10s.json` 或 `segments-6s.json`
- 如有，补充 `<project>/planning/extra-preview-rows.json`

输出格式：
- 标题
- 成片口播文案
- 分镜列表（按序号）

保持“可直接复制给另一个 AI”的干净文本，不夹杂排障信息。

## 4) Bridge 配置说明（OpenClaw 模式）

`bridge-config.json` 示例：

```json
{
  "mode": "openclaw",
  "gatewayBase": "http://127.0.0.1:18789",
  "gatewayToken": "",
  "gatewayHealthPath": "/healthz",
  "gatewayReadyPath": "/readyz",
  "defaultSessionKey": "main",
  "allowSessionOverride": false,
  "defaultModel": "gpt-5.3-codex"
  "timeoutMs": 120000,
  "openclawAdapter": "ready",
  "guard": {
    "enabled": true,
    "injectSystemPrompt": true,
    "systemPrompt": "仅允许剧本/图片/声音相关任务；拒绝网页本体改动请求",
    "allowKeywords": ["剧本", "分镜", "script", "提示词", "图片", "图像", "配音", "声音", "音频", "旁白"],
    "denyKeywords": [".html", ".js", ".css", "网页", "页面", "预览页", "bridge-server", "bridge-config", "start-local-preview", "start-chat-bridge"]
  }
}
```

右侧聊天窗默认请求：
- `http://127.0.0.1:12732/v1/chat/completions`

bridge 负责：
- 给浏览器页面做本地 HTTP 桥接
- 以 OpenClaw Gateway 为目标做探测和适配
- 对外仍维持预览页易接入的 `/v1/chat/completions` 入口
- 不再要求用户配置 generic OpenAI-compatible upstreamBase
- 可启用 guard 范围控制：仅允许“剧本/图片/声音”相关请求，网页/脚本改动请求直接 403 拒绝
- 默认锁定 `defaultSessionKey`（`allowSessionOverride=false`），避免页面请求随意切 session

说明：
- 现在的 bridge 已经切到 **OpenClaw 配置语义**，并完成真实会话转发。
- 页面传 `chatModel=gpt-5.4`、`lobster-chat` 这类“非 openclaw/*”值时，bridge 会自动兼容：
  - 请求体 `model` 改为 `openclaw`（满足 Gateway 合法值要求）
  - 原始值放进 `x-openclaw-model` 作为模型覆盖尝试
  - 若覆盖无效/不允许（含 `Invalid model`、`Model ... is not allowed for agent`），会自动降级重试（去掉 `x-openclaw-model`）

## 5) 右侧聊天窗口 Markdown 默认支持（维护要点）

当用户要求“右侧聊天窗默认支持 md/markdown 回复”时，按这个最小改动路径：

1. 页面渲染链路确认（`assets/zhihe-storyboard-preview-flashback.html`）
   - bot 消息必须走 `markdownToHtml(...)`
   - user 消息保持 `escapeHtml(...)`（不要当作 markdown 渲染）
   - bot 内容外层使用 `<div class="md-content">...</div>`

2. 样式确认（`md-content`）
   - 至少覆盖：标题、列表、blockquote、`code`、`pre code`、链接、分隔线
   - 避免把 `.msg.bot` 设成 `white-space: pre-wrap`（会影响块级 markdown 的正常布局）

3. 提示词确认（system prompt）
   - 在 `buildChatMessages` 的 system 内容中明确写：
     “允许并优先使用 Markdown（标题、列表、加粗、代码块、链接等）”

4. 回包兼容（经验坑）
   - 不要只读 `choices[0].message.content`。
   - 需要兼容多种结构：
     - `choices[0].message.content`（可能是 string 或 array）
     - `choices[0].delta.content`
     - `output[0].content`
     - `output_text`
   - 建议维护统一提取函数（如 `normalizeAssistantContent`），先归一化成字符串再进 markdown 渲染。

5. 验证
   - 发送包含 `# 标题`、列表、代码块、链接的测试消息
   - 确认 bot 消息为富文本显示、user 消息仍是纯文本

## 6) 项目加载优化：优先本地 JSON 索引（避免目录页解析）

当用户要求“加载项目更稳定/更快，直接读本地 json”，按这个路径改：

1. 在 `bridge-server.js` 提供项目索引 API
   - `GET /api/projects`：返回项目列表
   - `GET /api/projects?refresh=1`：强制刷新（扫描目录并重写索引）
   - `POST /api/projects/rebuild`：重建索引（供手动按钮或脚本触发）

2. 索引文件位置
   - 默认：`assets/project-index.json`
   - 可用环境变量覆盖：`STORYBOARD_PROJECT_INDEX_JSON`
   - 建议结构：

```json
{
  "updatedAt": "2026-04-12T07:32:48.250Z",
  "projects": ["episode-1-20260320-113900"]
}
```

3. 索引生成规则
   - 扫描 `assets` 下项目目录
   - 仅保留匹配前缀：`episode-|cat-|trenchcoat-|opc-|auto-selection-`
   - 仅保留存在 `planning/` 子目录的项目
   - 去重 + 排序后写回 JSON

4. 前端 `discoverProjects()` 的优先级
   - 优先请求 bridge：`/api/projects`
   - 若失败：回退 `localStorage` 缓存（如 `grok_storyboard_project_index_v1`）
   - 再失败：最后才回退旧目录页解析 `fetch('./') + DOMParser`

5. UI 行为建议
   - “刷新项目列表”按钮改为 `discoverProjects({ forceRefresh: true })`
   - 状态文案区分来源（`api/json/cache/fallback`），便于排障

6. 验证清单
   - `node --check bridge-server.js` 通过
   - `GET http://127.0.0.1:12732/api/projects` 返回 200
   - `GET .../api/projects?refresh=1` 返回 200 并更新 `assets/project-index.json`
   - 页面刷新后项目下拉可直接加载，不依赖目录页样式

## 7) 技能边界

- 这是项目内工具页 + 本地 bridge，不是 OpenClaw 内置功能页。
- 浏览器页面不能直接调用 OpenClaw runtime；需要通过本地 bridge 走 HTTP。
- 现在默认目标不是 generic upstream，而是本机 OpenClaw Gateway。
- 在真正会话转发 adapter 接完之前，health 可用不等于聊天已完全接通。
- 不修改用户项目文案内容，除非用户明确要求“改写/重写”。
- 仅在本地工作区内读写，不做外发。
