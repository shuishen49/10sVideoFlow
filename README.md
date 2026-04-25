# 10sVideoFlow

这个仓库是一个视频生成与分镜预览的工具集合，包含：

- 本地分镜预览与聊天桥接（`grok-storyboard-preview/`）
- 基于 Pic2API 的视频生成脚本（`video-generation-pic2api/`）
- 灵感视频辅助工具与脚本（`linggan-video-tools/`）

适合用于：快速验证分镜、调用模型生成视频、在本地预览并迭代内容。

## 项目结构

```text
10sVideoFlow/
├─ grok-storyboard-preview/      # 分镜预览页 + 本地 bridge
├─ video-generation-pic2api/     # Pic2API 视频生成脚本
├─ linggan-video-tools/          # 灵感视频工具与输出
├─ image/                        # 项目截图素材
└─ README.md
```

## 快速开始

### 1) 分镜预览（推荐先跑通）

进入 `grok-storyboard-preview/`，双击：

- `启动知合分镜预览-Node驱动.bat`

默认会启动：

- 预览服务：`12731`
- 聊天 bridge：`12732`

详细说明见：`grok-storyboard-preview/README.md`

### 2) 视频生成（Pic2API）

进入 `video-generation-pic2api/`，先配置 `.env`，再运行脚本：

- Python 脚本：`scripts/generate_video.py`
- Shell 脚本：`scripts/generate_video.sh`

详细参数见：`video-generation-pic2api/README.md`

### 3) 灵感视频工具

进入 `linggan-video-tools/`，按 `SKILL.md` 和 `scripts/` 使用。

## 环境变量与安全

仓库已配置忽略敏感文件（根目录 `.gitignore`）：

- 忽略：`.env`、`.env.*`
- 保留模板：`.env.example`

请务必遵循：

- 真实密钥只放在本地 `.env`
- 提交前确认不包含真实 token/key
- 对外共享时只提供 `.env.example`

## 截图

以下是项目相关截图（来自 `image/` 目录）：

![截图1](./image/屏幕截图%202026-04-21%20145115.png)

![截图2](./image/屏幕截图%202026-04-21%20145153.png)

![截图3](./image/屏幕截图%202026-04-21%20145218.png)

## 常见问题

- 页面打不开：先检查 `12731` 是否启动
- 聊天不通：检查 `12732/health`
- 网关不可用：检查 `18789/healthz` 与 `18789/readyz`
- 内容不刷新：浏览器 `Ctrl + F5`

## 说明

- 本仓库偏向本地开发、预览与内容生产流程，不是线上生产部署模板。
- 如需扩展能力，优先在各子目录的 `README.md` / `SKILL.md` 中补充。


[![加入QQ群](https://img.shields.io/badge/QQ群-点击加入-blue.svg)](https://qm.qq.com/cgi-bin/qm/qr?k=kSKwz-HRqrddrALgfLqCp7C2-aGZqPlv&jump_from=webapi&authKey=KUwPZ1lgzoIXjwIf/AfQ0UFFhRcUAO8VAdZk2kVdrGHQhxyhlgn30vX1SCX5Lu8d) (群号: 83958598)
