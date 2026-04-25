# gitskill 审计说明

## 结论

`gitskill/` 当前更适合被定义为一个 **skill monorepo（多 skill 仓库）**，而不是单个标准 OpenClaw / Lobster skill。

也就是说：
- `gitskill/` 根目录本身不是一个标准 skill
- 各子目录才更接近真正的 skill 单元
- 当前仓库能用，但从结构规范上看还不够“标准化”

---

## 当前观察到的结构特征

根目录目前承担了两类职责：

1. **仓库导航 / 项目说明**
   - `README.md`
   - 截图素材与整体介绍

2. **多个子能力的聚合容器**
   - `grok-storyboard-preview/`
   - `linggan-video-tools/`
   - `video-generation-pic2api/`

这说明它更像“技能仓库”而不是“一个 skill”。

---

## 为什么说它“不算标准单 skill”

标准 skill 通常是：

```text
<skill-name>/
├─ SKILL.md
├─ scripts/        # 可选
├─ references/     # 可选
└─ assets/         # 可选
```

而 `gitskill/` 根目录：
- 没有根级 `SKILL.md`
- 包含多个彼此相对独立的子目录
- 还混有仓库说明、截图、git 管理信息等

所以它本身不适合作为“一个被直接触发的 skill”。

---

## 主要不标准点

### 1. 根目录不是 skill 入口

- 缺少根级 `SKILL.md`
- 因此根目录自己不能按标准 skill 被识别为一个完整单元

### 2. 仓库层与 skill 层混在一起

根目录既像：
- 开发仓库
- 工具集合
- 演示项目
- skill 汇总目录

这会让“什么是可复用 skill，什么是本地项目内容”变得不够清晰。

### 3. 子目录风格不完全统一

目前几个子目录虽然都接近 skill，但结构不完全一致，例如：
- 有的说明大量依赖 `README.md`
- 有的核心信息主要塞在 `SKILL.md`
- 有的明显带有项目运行产物/本地配置痕迹

### 4. skill 与项目产物边界不够清楚

在 skill 语境下，以下内容通常不应作为“可复用 skill 主体”存在：
- `.env`
- 截图素材
- outputs / logs / runs
- 一次性生成结果
- 调试缓存

但在本地仓库里，这些内容又可能是有用的。这就说明当前仓库更偏“开发态”。

### 5. README 倾向较重

从 skill 规范角度，`SKILL.md` 才应该是 agent 侧主入口。`README.md` 更适合给人看。

现在这个仓库中，有些内容更像“项目说明文档”，而不是“面向 agent 的最小执行说明”。

---

## 当前更合理的定义

建议将本目录定义为：

> **一个用于管理多个相关 skill 的 monorepo**

这种定义下，当前结构是说得通的：
- 根目录：仓库导航层
- 子目录：可独立整理和演进的 skill

---

## 推荐的维护原则

### 原则 1：不强迫根目录变成 skill

没有必要强行给根目录补一个 `SKILL.md`，把整个仓库伪装成一个 skill。

更自然的做法是承认它是：
- 仓库
- 聚合层
- 开发容器

### 原则 2：以后按“子 skill”逐个规范化

优先把每个子目录分别整理，而不是试图一次性重构整个仓库。

### 原则 3：少动现有流程，先补文档边界

如果当前项目已经能跑，优先：
- 补说明文档
- 标出哪些是仓库层、哪些是 skill 层
- 标出哪些文件属于运行态，不属于 skill 主体

这样最稳。

---

## 建议的仓库分层理解

### 仓库层（repo layer）
用于：
- 导航
- 汇总
- 说明
- 演示

典型文件：
- `README.md`
- 审计说明
- 规范建议文档

### skill 层（skill layer）
用于：
- `SKILL.md`
- 执行脚本
- 参考资料
- assets

典型目录：
- `grok-storyboard-preview/`
- `linggan-video-tools/`
- `video-generation-pic2api/`

---

## 子目录级建议

### 1. grok-storyboard-preview/

优点：
- 已有 `SKILL.md`
- 目标比较明确：本地预览页 + bridge + 排障

问题：
- 内容偏胖
- 维护说明很多，未来可考虑拆到 `references/`
- README 与 SKILL 的职责边界还可再清楚些

### 2. linggan-video-tools/

优点：
- `SKILL.md` 内容完整
- 工作流明确
- 规则和约束写得比较细

问题：
- 体量很大
- 说明过重，适合分拆 references
- 更像“复杂工作流 skill”，需要继续瘦身与模块化

### 3. video-generation-pic2api/

优点：
- 范围最聚焦
- 最接近可独立整理成标准 skill 的形态

问题：
- 有 `.env` 依赖
- 文档仍偏 README 驱动
- 后续可补 `.env.example`、references、最小执行说明

---

## 最保守、最稳的推进方案

如果目标是：
- 不破坏现有项目
- 不大动结构
- 先把“规范性”说清楚

那么最稳的方式就是：

1. 保留现状运行结构
2. 新增若干 `.md` 说明文件
3. 把仓库定义为 monorepo
4. 逐个子目录补审计说明，而不是直接重构

---

## 推荐后续文档化动作

可继续新增这些文档：

- `SUBSKILLS.md`
  - 说明有哪些子 skill、各自负责什么
- `STANDARDIZATION-PLAN.md`
  - 记录后续规范化路线
- `grok-storyboard-preview/AUDIT.md`
- `linggan-video-tools/AUDIT.md`
- `video-generation-pic2api/AUDIT.md`

这样可以只加文档，不改项目逻辑。

---

## 一句话总结

`gitskill/` 不标准的核心不是“它写坏了”，而是：

> **它其实不是一个单 skill，而是一个多个 skill + 本地项目内容混合的仓库。**

如果把它当成 **skill monorepo** 来理解，它就合理得多；后续只需要把各子目录逐步规范化即可。
