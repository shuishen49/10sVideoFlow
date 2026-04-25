# gitskill 子 skill 清单

这个仓库更适合作为一个 **多 skill 仓库（skill monorepo）** 来理解。

下面是当前可见的主要子 skill / 子能力目录。

---

## 1. grok-storyboard-preview

**定位**
- 本地分镜预览页
- 本地聊天 bridge
- 预览页相关排障
- 文案导出 / project 分镜查看

**已有特征**
- 已存在 `SKILL.md`
- 同时存在项目说明性质的 `README.md`
- 带本地运行相关文件（bridge、preview server、bat 启动脚本等）

**当前判断**
- 它已经接近一个完整 skill
- 但仍带明显“项目工具包”特征
- 后续更适合通过补文档、拆 references 的方式慢慢规范化

---

## 2. linggan-video-tools

**定位**
- 角色图生成
- 分镜图生成
- 视频任务生成
- 批量工作流与阶段推进

**已有特征**
- 已存在 `SKILL.md`
- 工作流描述很完整
- 偏重、偏复杂、约束多

**当前判断**
- 这是一个“复杂工作流 skill”
- 目前更像成熟内部流程包，而不是轻量标准 skill
- 最适合后续做文档拆分与模块化整理

---

## 3. video-generation-pic2api

**定位**
- 基于 pic2api 的文生视频 / 图生视频
- 支持任务提交与轮询获取视频 URL

**已有特征**
- 已存在 `SKILL.md`
- 有 `scripts/`
- 有 `README.md`
- 依赖 `.env`

**当前判断**
- 这是当前最适合优先标准化的子 skill
- 职责范围最聚焦
- 未来如果要做“标准 skill 示例”，它最适合先整理

---

## 总体结论

当前仓库不是一个单独的标准 skill，而是由多个子 skill 与项目辅助内容组成。

因此建议采用以下理解方式：
- 根目录：仓库导航层
- 子目录：实际 skill 单元
- 文档：用于解释边界与后续标准化路线

如果后续继续规范化，建议优先顺序：
1. `video-generation-pic2api`
2. `grok-storyboard-preview`
3. `linggan-video-tools`
