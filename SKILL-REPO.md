# gitskill skill monorepo

这个目录不是一个单独的 OpenClaw / Lobster skill，
而是一个 **skill monorepo（多 skill 仓库）**。

## 定位

根目录用于：
- 聚合多个相关 skill
- 统一管理脚本、资源与示例
- 作为本地开发与整理仓库存在

因此：
- 根目录 **不要求** 自己成为一个 skill
- 真正可触发、可分发的 skill 应该位于各子目录内
- 每个子 skill 应尽量满足标准结构：
  - `SKILL.md`
  - `scripts/`（可选）
  - `references/`（可选）
  - `assets/`（可选）

## 当前建议的子 skill

- `grok-storyboard-preview/`
  - 本地分镜预览页、bridge、预览相关排障与文案导出
- `linggan-video-tools/`
  - 灵感服务相关的角色图、分镜图、视频生成流程
- `video-generation-pic2api/`
  - 基于 pic2api 的独立视频生成能力

## monorepo 约束

### 1. 根目录允许存在的内容

- `README.md`：仓库级导航说明
- `SKILL-REPO.md`：仓库定位与维护约束
- `.gitignore`
- 各子 skill 目录
- 必要的仓库级截图、示例、辅助说明（尽量少）

### 2. 子 skill 应尽量避免混入的内容

以下内容原则上不应作为 skill 的核心组成部分被分发：
- `.env`
- 真实密钥
- `outputs/`
- 运行日志
- 临时截图
- 调试缓存
- `__pycache__/`
- 大量一次性生成产物

可保留在本地开发仓库中，但应通过 `.gitignore` 排除，或在后续整理时迁移出 skill 目录。

### 3. 文档约束

- `SKILL.md` 是 skill 的主入口
- 详细但非必需的说明，优先放 `references/`
- 对于可分发 skill，尽量减少对 `README.md` 的依赖
- 仓库级 `README.md` 可以保留，用于人类查看与导航

### 4. 结构建议

每个子 skill 推荐尽量整理成：

```text
<skill-name>/
├─ SKILL.md
├─ scripts/
├─ references/
├─ assets/
└─ .env.example   # 如果确实需要环境变量
```

## 后续整理建议

后续可以按子目录逐个做规范化：
1. 清理 README-heavy 内容，把真正会影响 agent 执行的部分保留在 `SKILL.md`
2. 把长说明拆到 `references/`
3. 把脚本统一放进 `scripts/`
4. 把截图、演示图、生成结果与 skill 主体解耦
5. 为需要配置的 skill 补 `.env.example`

## 维护原则

- 先保证“能用”
- 再整理到“像标准 skill”
- 尽量不破坏现有本地工作流
- 优先做无痛重构，再做目录瘦身
