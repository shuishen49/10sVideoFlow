---
name: linggan-video-tools
description: 调用灵感服务生成角色图与 Grok 视频（已适配无需 sso 的 /api/v1/user-video/create）。支持“给剧本后一键分段出片”的交互流程，含并发与排队约束。
---

# linggan-video-tools

## 适用场景

当用户希望：
- 给你一段剧本，自动拆段并批量生成 Grok 视频；
- 先确认人物，再逐步“下一步”推进；
- 严格控制任务并发（图片最多 2、视频最多 2）并且必须等待完成再继续。

## 默认参数与强制确认

1. **画面比例默认值：9:16**。
2. 如果用户未明确给出以下信息，**必须先确认后再提交任何任务**：
   - 风格（如写实、动漫、电影感、赛博、国风等）
   - 比例（即使默认 9:16，也要让用户点头确认）
3. 推荐在同一条确认消息里一次问清：
   - 风格
   - 比例（默认 9:16）
   - 单段时长策略（优先 6s，后续 10s）

## 目标工作流（剧本 → 视频）

### 第 0 步：收集输入
- 剧本全文（必需）
- 风格（必需，若缺失先问）
- 比例（必需确认，默认 9:16）
- 角色清单（可从剧本提取后让用户确认）

### 第 1 步：角色确认（先于批量生成）
1. 根据剧本抽取角色（名字、外观、年龄感、服装、气质、关键道具）。
2. 发给用户确认：
   - 是否缺角色/要删角色
   - 每个角色是否需要调整
3. 用户确认后，再进入角色图生成。
4. **角色重设计触发规则（新增，强制）**：
   - 若剧情进入新阶段后出现“角色外观/服饰/妆造/伤痕/道具状态/伪装状态（如装盲）”明显变化，必须先暂停后续生成，重新做该角色设计与确认。
   - 重新设计后，必须更新并落盘：`planning/characters-confirmed.json`（可附版本号如 `v2`），并在后续分镜图与视频提示词中引用新设定。
   - 未完成重设计确认前，禁止继续提交该阶段的视频任务。

### 第 2 步：角色图生成（并发上限 2）
- 接口：`/api/v1/short-drama/generate-character-image`
- 约束：
  - **同时最多 2 个图片任务**
  - 任务未完成前，不再提交第 3 个
- 调度策略：
  - 建立图片任务队列
  - 只在有空槽位时取下一个任务提交
  - 任一任务完成后再补位
- 角色三视图新增规则（强制）：
  - 若用户要求“人物三视图/角色设定图”，**禁止强制使用 9:16**；优先使用更适合三视图排版的比例（如 16:9、3:4 或 1:1）。
  - 只有当用户明确指定角色图比例时，才按用户比例执行。
  - 若剧本的人名与语境明显偏欧美（如 Primrose/Nancy、欧美都市酒吧语境），提示词需显式写：`modern Western / Euro-American facial features (not East Asian)`，避免默认生成亚洲脸。
  - 若用户明确指定人种/地域外观，则以用户指定为最高优先级。 

### 第 3 步：剧本拆段
- 第一轮优先拆成 **6 秒/段**（尽量贴合动作与语义断点）。
- 第一轮完成后，再按需求做 **10 秒/段**版本。
- 每段输出：
  - 段号
  - 时长（6s 或 10s）
  - 画面描述（镜头、动作、景别、光线）
  - 对白/旁白（如有）
  - 角色引用（对应已确认角色）

### 第 4 步：分镜图生成（先于视频，图片并发上限 2）
- 目标：先为每个分段生成**分镜图**（= 场景 + 人物动作关系），再进入视频任务。
- 接口：`/api/v1/short-drama/generate-shot-image-with-refs`
- 强制流程（新增，必须执行）：
  1. 先基于该段 `scene + visual + dialogue` 组装 `script`
  2. 再基于该段 `script` 生成“当前段专用提示词（prompt_override）”
  3. 最后把 `script + prompt_override` 一起提交给生图 API
  - 严禁跳过第 2 步；严禁把空泛提示词直接提交 API
- 约束：
  - **同时最多 2 个图片任务**
  - 当前批次分镜图未完成，不进入视频创建
- 结果要求：
  - 每段至少绑定 1 张分镜图（`sceneImageUrl`）
  - 分镜图必须包含：明确场景背景 + 角色出镜（不可仅人物立绘，也不可纯空场景）
  - **提示词必须按段动态生成**（scene/visual/dialogue 三者拼接），禁止对所有段复用同一固定场景提示词
  - `prompt_override` 必须是“当前段专用约束”，不得把 S01 的外景元素（如码头/暴雨）写死到 S03/S04/S05…
  - 记录段号与分镜图的对应关系

### 第 4.5 步：分镜图生成后质检（新增，强制）
每次生成分镜图后，必须先质检再判定通过，禁止“只看 HTTP 200 就算成功”。

- **接口可用性检查（新增，强制）**：
  1. 先检查响应体是否包含 `sceneImageUrl/url` 且为可访问图片链接（建议 HEAD/GET 校验 Content-Type 为 image/*）。
  2. 再检查响应文本是否包含风控拒绝文案（如 `guardrails`、`may violate`、`teens and children`、`未成年人` 等）。
  3. 若命中上述风控文案，即使 HTTP=200 也必须判定为“不通过”，禁止进入视频创建。
  4. 必须重试并改写提示词（保持剧情不变），优先显式补充“角色均为成年人（25+）”。

- 质检维度（至少逐项核对）：
  1. **画幅**：必须 9:16 竖版（禁止方图/横图）
  2. **场景一致性**：地点/时间/天气必须与该段 script 一致（如“荒废码头夜外”不能变室内）
  3. **人物一致性**：人物必须出镜，且外观与参考图一致
  4. **叙事动作**：该段关键动作必须出现（如 S06 的“看见/掌心受伤”）
  5. **构图约束**：环境占比要高，不能变成纯人像海报、白底棚拍
  6. **风险退化**：若出现“画面被安全策略洗白/过度抽象/动作缺失”，判定不通过
  7. **文字洁净**：画面中不得出现任何可读文字（中英文字幕、标题、UI 文案、水印）；若出现即判定不通过并重试

- 结果记录（强制落盘）：
  - 将质检结果写入 `runs/image-qa.jsonl`，至少包含：
    - `segmentId`
    - `sceneImageUrl`
    - `qa.pass`（true/false）
    - `qa.issues`（不通过原因列表）
    - `qa.checkedAt`

- 不通过处理：
  - 必须重试该段，不得进入后续视频创建
  - 重试时保留剧情语义，必要时对高风险词做“弱化等价改写”以减少拦截（例如“滴血”→“掌心有血痕/受伤痕迹”），但不得改变剧情走向
  - 每次重试都要记录“本次 script / prompt_override / 结果 URL / QA 结论”

- **闪回冲突场景安全改写规则（新增，强制）**：
  - 当场景是“室内闪回 + 男女肢体冲突”时，禁止使用容易触发色情/裸露风控的措辞。
  - **禁止词（示例）**：`拉扯衣物`、`撕开裙子/衣服`、`床上纠缠`、`裸露`、`性暗示`、`挑逗`。
  - **替换为安全动作词**：`逼近威压`、`威胁姿态`、`激烈对峙`、`后退躲避`、`双手防御`、`惊恐失措`。
  - 画面表达要点：
    1) 重点放在“压迫感/恐惧/冲突”，而非衣物细节；
    2) 明确“人物均为成年人（25+）”；
    3) 明确“不得出现裸露或性暗示画面”；
    4) 保持 9:16 竖版、电影写实、环境可辨识。
  - 推荐安全模板（可直接复用）：
    - `督军府夜内闪回，中近景。赫连城对苏甜施加威压并逼近，苏甜惊惧后退、双手防御。昏暗室内、老式家具与窗帘形成压迫氛围。人物均为成年人（25+），不出现裸露或性暗示画面。9:16竖版，电影写实。`

- **武器冲突场景（刀/刺/接刃）防违规规则（新增，强制）**：
  - 当提示词涉及刀具、刺击、接刃等动作时，优先写“冲突张力/情绪对抗”，避免“直接伤害动作细节”。
  - **高风险词（尽量避免）**：`举刀刺下`、`刀刃接触身体`、`空手接刃特写`、`刺入`、`流血特写`、`致命`。
  - **推荐替换词**：`持刀逼近`、`对峙僵持`、`抬手防御`、`动作受阻`、`高压冲突`、`求生意志`。
  - 提示词中应增加防违规约束：
    1) `不出现血腥、伤口、穿刺细节特写`；
    2) `不描述刀刃与身体直接接触`；
    3) `以表情、姿态、环境压迫感替代伤害细节`。
  - 四宫格/九宫格场景推荐写法：
    - 中间分镜用“逼近/防御/僵持”推进冲突；
    - 末格用“情绪兑现（恐惧→坚定）”收束，不写伤害结果。
  - 若返回包含 `may violate our guardrails around violence`（或同义暴力拦截），必须自动降级改写后重试：
    - 先删掉刺击、接刃、伤害细节；
    - 再保留剧情逻辑（威压→防御→僵持→情绪爆发）；
    - 再次提交并记录改写前后差异。

### 第 5 步：视频生成（并发上限 2）
- 接口：`/api/v1/user-video/create`
- 约束：
  - **同时最多 2 个视频任务**
  - **必须等待已提交任务完成**，再推进后续批次
  - **视频画面禁止任何字幕/叠字**（中英文均禁止），包括对白字幕、旁白字幕、字卡、logo 文本、水印文本；视频提示词必须显式写 `no subtitles, no on-screen text`。
- 比例锁定规则（强制）：
  - 在创建 Grok 视频前，先将黑底比例图上传 OSS 作为第一参考图：
    - 9:16 使用 `black_9x16.png`
    - 16:9 使用 `black_16x9.png`
  - 提示词首句必须加：`@Image 1`
  - 目的：用第一张黑底图锁定画幅，避免比例漂移（该图不用于内容表达）。
  - 注意：黑底图可能只在首帧/极短时间出现，这是预期行为；其作用是约束画幅，不是提供视觉内容。
- 视频提示词结构规则（新增，强制）：
  - 必须显式写 `@Image 2` 作为当前段分镜图参考（`@Image 1` 仅用于比例锁定）。
  - 必须显式写 `sc` 分镜节拍与时长分配，禁止只写笼统“10秒视频”。
    - 6s 段：默认四段节拍（例如 `sc1=1.5s; sc2=1.5s; sc3=1.5s; sc4=1.5s`）
    - 10s 段：默认九段节拍（例如 `sc1..sc9`，总时长=10s）
  - 必须写清 `hard cut only`（纯硬切）与相邻分镜动作连续约束。
  - 若缺少 `@Image 2` 或缺少 `sc时长`，判定为提示词不合格，禁止提交视频任务。
- 调度策略：
  - 视频任务队列 + 2 槽位 worker
  - 任务完成才释放槽位
  - 失败任务进入重试队列（建议最多重试 1~2 次）

### 第 5.5 步：视频完成后剧情匹配评分（新增，强制）
每个分段视频一旦产出（拿到 `videoUrl` 或明确完成状态），必须立即做“剧情匹配评分”，并在用户确认前暂停后续流程。

- 评分目标：判断“视频是否是该段剧情所需要的画面”，重点看剧情相关程度。
- 评分范围：0~100 分。
- 推荐维度（可调权重）：
  1. 场景一致性（地点/时间/天气）
  2. 关键动作命中（该段必须出现的动作）
  3. 人物一致性（角色是否正确且关系成立）
  4. 情绪与叙事转折（是否体现该段情绪目标）
  5. 技术状态（视频是否可播放、是否完整）

- 结果记录（强制落盘）：
  - 写入 `runs/video-qa.jsonl`，至少包含：
    - `segmentId`
    - `videoUrl` / `videoId`
    - `qa.score`（0~100）
    - `qa.level`（高/中/低）
    - `qa.reasons`（命中与缺失点）
    - `qa.checkedAt`

- 执行规则（强制）：
  - **视频完成后先评分，再决定下一步**
  - **若用户要求“先调评分机制”**：只更新评分逻辑和展示，不推进新的视频任务

### 第 6 步：交互推进（“下一步”模式）
- 每完成一个阶段，向用户汇报并等待指令：
  - “已完成角色确认，回复【下一步】开始生成角色图”
  - “角色图已完成，回复【下一步】开始 6s 分段规划”
  - “6s 分段已完成，回复【下一步】开始分镜图生成”
  - “分镜图已完成，回复【下一步】开始 6s 视频任务”
  - “6s 视频已评分完成，回复【下一步】再进入后续版本/阶段”
- 用户说“下一步”才继续，避免误触发大批量任务。

## 项目文件夹持久化（强制）

每次处理一个剧本任务，都必须先创建并使用**独立项目文件夹**保存关键信息，禁止只在对话里临时保留。

### 目录规范

根目录：`projects/grok-drama/`

项目目录命名：
- `projects/grok-drama/<项目名>-<YYYYMMDD-HHMMSS>/`
- 若用户未提供项目名，可用：`episode-<集数>` 或 `drama-run`

推荐结构：

- `input/`
  - `script.txt`（原始剧本）
  - `user-requirements.json`（风格、比例、语言、时长策略等）
- `planning/`
  - `characters-draft.json`（角色抽取草案）
  - `characters-confirmed.json`（用户确认后的角色）
  - `segments-6s.json`
  - `segments-10s.json`
- `prompts/`
  - `character-image-prompts.json`
  - `video-prompts-6s.json`
  - `video-prompts-10s.json`
- `runs/`
  - `image-jobs.jsonl`（图片任务提交与状态流水）
  - `video-jobs.jsonl`（视频任务提交与状态流水）
  - `checkpoints.json`（当前阶段、已完成段号、失败重试计数）
- `outputs/`
  - `images/`（角色图）
  - `videos/`（视频文件或下载记录）
  - `manifest.json`（产物总清单）
- `logs/`
  - `timeline.md`（关键操作时间线）
  - `errors.jsonl`（失败详情）

### 关键保存要求

1. 用户给出的原始剧本必须落盘：`input/script.txt`。
2. 用户确认过的关键信息必须落盘：
   - 风格、比例、语言、集数、时长策略
   - 角色确认结果
3. 每次任务提交都要记录：
   - 本地任务号（如 `VID-06s-03`）
   - 服务端任务 ID
   - 提交参数摘要
   - 状态变更（排队/进行中/完成/失败）
4. 每个阶段完成后都更新 `runs/checkpoints.json`，用于断点续跑。
5. 给用户汇报时，优先基于项目文件夹内记录，不凭“临时记忆”。

## 执行口径（必须遵守）

1. **不跳过确认**：缺风格/比例时不能直接开跑。
2. **不超并发**：图片最多 2、视频最多 2。
3. **不抢跑后续**：当前批次未完成，不提交后续批次。
4. **状态透明**：每次汇报“排队中 / 进行中 / 已完成 / 失败”。
5. **先分镜后视频**：每个分段必须先有分镜图（场景+人物），再允许创建对应视频任务。
6. **可恢复**：记录任务 ID、段号、参数，支持断点续跑。
7. **强制落盘**：所有关键信息必须按项目文件夹保存，不得只留在对话中。

## 推荐状态模板

- 图片任务：
  - `IMG-01 进行中`
  - `IMG-02 已完成`
  - `IMG-03 排队中`
- 视频任务：
  - `VID-06s-01 进行中`
  - `VID-06s-02 已完成`
  - `VID-06s-03 排队中`

## 接口与脚本

现有脚本：
- `scripts/call_generate_character_image.py`
- `scripts/call_generate_shot_image_with_refs.py`
- `scripts/regenerate_scene_images_6s.py`（新增：参数化批量重生成，不写死项目内容）
- `scripts/call_grok_video_create.py`
- `scripts/call_upload_to_oss.py`
- `scripts/test_token_user_video.py`

鉴权兼容说明（新增）：
- 以上脚本现在优先兼容两种鉴权方式：
  1. `--token`：继续沿用原来的用户 token 请求
  2. `--api-key`：可直接走服务 API Key
- 当前本地联调默认地址（临时切换）：
  - 前端：`http://127.0.0.1:3000`
  - 后端 API：`http://127.0.0.1:9000`
  - 上述 Python 脚本默认已改为走 `127.0.0.1:9000`
- 脚本会自动附带兼容请求头：
  - token 模式：`token` + `Authorization: Bearer <token>`
  - api key 模式：`x-api-key` + `Authorization: Bearer <api-key>`
- 若服务端已经开放 API key，优先推荐在自动化脚本中使用 `--api-key`，避免依赖用户态 token。
- 当前角色生图接口已验证可用口径：本地 `http://127.0.0.1:9000/api/v1/short-drama/generate-character-image`，请求头使用 `Authorization: Bearer <api-key>`，模型优先 `gpt-5.2`，不要默认切到 `qwen-image-plus`。

Skill 内置比例锁图：
- `black_9x16.png`
- `black_16x9.png`

建议用法：
- 角色图：先组装角色提示词，按并发 2 提交并跟踪完成状态。
- 分镜图（多人物参考图）：调用 `generate-shot-image-with-refs`，通过 `character_image_urls` 传入 1~7 张人物参考图，先拿到每段分镜图再进入视频。
- 分镜图提示词生成规则（强制）：
  - `script = scene + visual + dialogue`（按段拼接）
  - `prompt_override` 必须由该段 `script` 动态生成，先抽取该段地点/时间/动作/情绪，再补充镜头与质量约束
  - 约束文案必须包含（中英均可，推荐两者都带）：
    - `分镜图，必须9:16竖版。严格遵循 script 内的当前段场景地点、时间、动作与情绪，不得替换成其他地点。人物必须与参考图一致且必须出镜，画面要体现人物关系与动作叙事。禁止纯人物立绘、禁止白底棚拍、禁止与 script 冲突的背景。镜头语言电影写实，构图清晰，叙事明确。`
    - `Framing constraint: output composition must strictly use 9:16 (vertical portrait). Do not use any aspect ratio other than 9:16. Do not produce square framing.`
  - 若某段是室内闪回，必须显式在该段提示词写明“室内/闪回”，并排除与其冲突的外景词
  - CLI 默认尺寸必须是 `1024*1792`；若不是 9:16 竖版，应直接报错拒绝提交（除非显式调试开关允许）
  - **提示词清洗规则（新增，强制）**：
    - 禁止输出“模型说明性元文本”或“格式教学文本”，例如：
      - `You must explicitly output panel descriptions in this format...`
      - `Panel 1: ... Panel 2: ...`（当该文案不是剧情本身时）
      - `Compose as a 4-panel storyboard grid...` 这类冗长模板句反复堆叠
    - 仅保留“剧情语义 + 镜头约束 + 安全约束”三类信息，避免把控制台指令式文本写进最终 prompt。
    - 对高风险词做等价弱化改写并保持剧情不变：
      - `kiss / kissing` → `dare-lean / moving in for a dare`
      - 其他可能触发性暗示或未成年人联想的词汇，改为中性叙事动作
    - 明确加入：`All characters are adults (25+)`，并加约束：`no sexualized body focus, no explicit intimacy details, no nudity`。
- 视频：按分段结果提交，严格并发 2，完成后再继续下一批。
- **S05+ 创作口径（新增，用户指定）**：
  - 先生成“**单张多宫格分镜图**”，而不是先拆多张单图：
    - 6s 对应 **四宫格单图**（grid4，sc1~sc4）
    - 10s 对应 **九宫格单图**（grid9，sc1~sc9）
  - 第一张全黑比例锁图保持不变（作为视频阶段 `@Image 1`）。
  - 人物图引用从第 3 个分镜开始强化（前两格可偏环境/动作铺垫，后续分镜强调人物关系）。
  - 分镜时长写法统一：按文案长度或正常语速台词时长分配，明确 `scX(起止秒)`。
  - 转场强制：全片纯硬切，禁止任何转场特效/缓冲，禁止多屏分屏。
  - 连续性强校验：`sc2 结束帧动作 = sc3 起始帧动作`，`sc3 结束帧动作 = sc4 起始帧动作`（九宫格按相邻分镜顺延）。
  - 多宫格生图阶段默认仍优先 9:16；若用户明确要求，可放宽到非 9:16。
- 小云雀式多分镜视频提示（新增推荐）：
  - 在一个视频 prompt 内显式写“分镜1/分镜2/分镜3 + 每段时长（如 `<duration-ms>4000</duration-ms>`）”
  - 多图参考按顺序绑定：`@Image 1` 对应分镜1，`@Image 2` 对应分镜2，`@Image 3` 对应分镜3
  - 时长建议仅用 6s / 10s 两档（与接口 `n_frames` 对齐）
  - 竖屏短剧默认 9:16；要在提示中写“同一空间连续叙事，禁止跳场景/现代元素/风格漂移”
  - 提示词中保留“角色音色、台词、环境音、动作目标”，避免生成成 MV 式空镜
- 新增“小云雀式多分镜合成”口径：
  - 在同一个视频 prompt 内显式写出分镜列表：`分镜1/分镜2/分镜3 + duration-ms`。
  - 按上传参考图顺序写明：`@Image 1 / @Image 2 / @Image 3` 对应各分镜，禁止错位引用。
  - 时长策略：仅 6s/10s；多分镜合成优先 10s（例如 3s+4s+3s）。
  - 提示词中要写清：风格（真人写实、电影风格、复古调色、民国女频）、连续场景约束、台词与音色、禁止项（不跳场景/不MV/不要现代元素）。

命令示例（分镜图，多图参考）：

```bash
python "C:\Users\Administrator\.openclaw\workspace\skills\linggan-video-tools\scripts\call_generate_shot_image_with_refs.py" --token "<TOKEN>" --script "夜晚街头，女主回头望向镜头，风吹动头发" --character-names "林月,阿泽" --character-image-urls "https://a.com/1.jpg,https://a.com/2.jpg,https://a.com/3.jpg" --size "1024*1792" --model "gpt-5-3"
```

命令示例（批量重生 6s 分镜图，参数化，不写死项目）：

```bash
python "C:\Users\Administrator\.openclaw\workspace\skills\linggan-video-tools\scripts\regenerate_scene_images_6s.py" \
  --project-root "C:\Users\Administrator\.openclaw\workspace\projects\grok-drama\episode-1-20260320-113900" \
  --token "<TOKEN>" \
  --script-source compose \
  --only-ids "S04,S05" \
  --prompt-constraint "分镜图，必须9:16竖版。严格遵循 script 内的当前段场景地点、时间、动作与情绪，不得替换成其他地点。人物必须与参考图一致且必须出镜，画面要体现人物关系与动作叙事。禁止纯人物立绘、禁止白底棚拍、禁止与 script 冲突的背景。镜头语言电影写实，构图清晰，叙事明确。 Framing constraint: output composition must strictly use 9:16 (vertical portrait). Do not use any aspect ratio other than 9:16. Do not produce square framing."
```

命令示例（小云雀式 3 分镜合成 10s，按参考图顺序 @Image 1..3）：

```bash
python "C:\Users\Administrator\.openclaw\workspace\skills\linggan-video-tools\scripts\call_grok_video_create.py" --token "<TOKEN>" --aspect-ratio "9:16" --video-length 10 --image-urls "<S01图URL>,<S02图URL>,<S03图URL>" --prompt "画面风格和类型: 真人写实, 电影风格, 复古调色, 民国女频。使用多图参考并按顺序创作：@Image 1 对应分镜1，@Image 2 对应分镜2，@Image 3 对应分镜3。分镜1<duration-ms>3000</duration-ms>... 分镜2<duration-ms>4000</duration-ms>... 分镜3<duration-ms>3000</duration-ms>..."
```

命令示例（测试 token 是否可用，使用 `/api/v1/base/userinfo`）：

```bash
python "C:\Users\Administrator\.openclaw\workspace\skills\linggan-video-tools\scripts\test_token_user_video.py"
```

若要临时换 token：

```bash
python "C:\Users\Administrator\.openclaw\workspace\skills\linggan-video-tools\scripts\test_token_user_video.py" --token "<NEW_TOKEN>"
```

命令示例（上传本地文件到 OSS）：

```bash
python "C:\Users\Administrator\.openclaw\workspace\skills\linggan-video-tools\scripts\call_upload_to_oss.py" --token "<TOKEN>" --file "C:\path\to\image.png"
```

公开读上传：

```bash
python "C:\Users\Administrator\.openclaw\workspace\skills\linggan-video-tools\scripts\call_upload_to_oss.py" --token "<TOKEN>" --file "C:\path\to\image.png" --public
```

本地检查页（分镜图库）启动方式：

```bash
cd C:\Users\Administrator\.openclaw\workspace\projects\grok-drama\episode-1-20260320-113900
python -m http.server 8010
```

打开：

```text
http://127.0.0.1:8010/ui/scene-gallery.html
```

说明：
- 页面会读取 `planning/scene-image-bindings-6s.json` 展示分镜图绑定结果。
- 若看不到最新数据，刷新时带时间戳参数（页面已自动加 `?t=`）。

## 对用户的默认话术（首轮）

当用户只说“给你剧本一键生成”时，先问：

> 收到。我先确认 2 个关键参数再开跑：
> 1) 风格要哪种？（写实/动漫/电影感…）
> 2) 比例我默认 9:16，你确认吗？
> 你确认后我会先做角色确认，然后按“6s 一段 → 10s 一段”并且每一步等你回复【下一步】再继续。
