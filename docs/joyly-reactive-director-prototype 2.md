# Joyly Reactive Director Prototype

这份文档整理当前已经存在的导演化与语音基础设施，并定义 Trivia 作为第一个 `phase + event + cue` 原型的落地方式。

## 1. 当前已经有的内容

### 流程权威

- Server 是游戏流程的唯一真相。
- `server/games/cosmic-trivia.js` 管理 `phase`、倒计时、答题、计分、下一题推进。
- `publicCosmicTriviaState()` 会把当前阶段、剩余时间、当前题目、结算结果投影给客户端。

### 导演 phase 底座

- `public/shared/director/flow.js`
  - 提供通用的 phase 定义方式。
  - 支持 `timer`、`audio-advance`、`hold` 三种模式。
- `public/games/cosmic-trivia/audio/director-flow.js`
  - 目前已定义 Trivia 的 phase 顺序与每个 phase 的默认语音。

### 演出与播放

- `public/games/cosmic-trivia/presentation.js`
  - 根据公共状态做视觉演出。
  - 负责播放主持人口播，并在 `audio-advance` phase 结束时通知 server 推进。
  - 已有背景音乐 ducking、榜单动画、题卡 reveal、胜利演出。

### 语音资产与管理

- `content/games/cosmic-trivia/audio/tts-manifest.json`
  - 管理 TTS 源文本、voice id、输出文件名。
- `public/games/cosmic-trivia/audio/host/phases/`
  - 当前主持人口播成品。
- `public/games/cosmic-trivia/audio/`
  - 当前题目题干语音。
- `server/voice-library/catalog.js`
  - 将语音素材按项目、phase、题目聚合成可浏览目录。
- `public/voice-library/`
  - 可试听、标记、复生成员的语音库 UI。

## 2. 当前系统的主要限制

目前的导演化已经不是纯硬编码，但仍然主要是：

- 进入某个 `phase`
- 播放这个 `phase` 对应的一组固定语音
- 播完后推进或等待

这会带来三个问题：

- 同一 phase 内发生的新情况无法自然回应。
- 视觉与语音很难在中途“重新对齐”。
- 语音资产仍然按 phase 组织，语义粒度还不够细。

典型例子：

- 玩家都已经秒答完了，但主持人还在说完整的答题引导。
- 排名突然大变动，但只有一个通用 scoring 台词。
- 某题没人答对时虽然有专用台词，但触发机制还是绑在 phase 进入上，不够细。

## 3. 原型目标

Trivia 原型要把导演系统升级为三层：

### Phase

定义玩法窗口与权限。

例如：

- `question-audio` 期间不能答题
- `answering` 期间允许提交答案
- `scoring` 期间只展示结果

### Event

定义“这个玩法窗口内发生了什么”。

例如：

- `phase entered`
- `all answered early`
- `no one correct`
- `rank changed`
- `final question reached`

### Cue

定义“导演应该播什么、怎么播、是否能打断、是否可丢弃”。

例如：

- `question.intro`
- `question.read`
- `answering.prompt.first-question`
- `answering.all-answered-early`
- `scoring.no-correct`
- `complete.outro`

## 4. 本次 prototype 的实现方式

### 4.1 保留现有 phase 权威

本次不改 server 的 phase 模型。Server 继续负责：

- 玩法推进
- 时间窗口
- 答案合法性
- 计分与 reveal 时机

### 4.2 新增 Reactive Cue Engine

新增共享模块：

- `public/shared/director/cues.js`

职责：

- 接收 `previousSnapshot` 与 `nextSnapshot`
- 根据规则判断有没有事件发生
- 为当前时刻选出最合适的一条 cue
- 生成一个可直接交给 presentation 播放的 plan

### 4.3 Trivia 改为“phase 默认 + event 覆盖”

`public/games/cosmic-trivia/audio/director-flow.js` 现在有两套能力：

- 原有 `createDirectorFlow()`：保留 phase 默认逻辑
- 新增 `getReactiveAudioPlan()`：根据 phase 和事件选择本次真正要播的 cue

这样做的好处是：

- 老的 gantt、phase 文档仍然成立
- 新逻辑只是在默认 phase 计划之上做更细的选择
- 其他游戏可以沿用同样的共享 cue engine

## 5. Trivia 当前落地的 cue 语义

当前已经在代码里落地的语义 cue：

- `lobby.intro`
- `preferences.locked`
- `deck.loading`
- `question.intro`
- `question.read`
- `answering.prompt.first-question`
- `answering.all-answered-early`
- `scoring.no-correct`
- `scoring.positive`
- `transition.next-question`
- `finale.intro`
- `complete.outro`

其中 `answering.all-answered-early` 是这次 prototype 的关键示例：

- 条件：还在 `answering` phase 内
- 前一个快照未全员答题
- 新快照已经全员答题
- 剩余时间仍大于 0

这说明语音不再只能在 `phase changed` 时触发，也可以在 `same phase, new event` 时触发。

目前这条 cue 先复用一条现有短语音做占位，等专门的 “all answers are in” 素材录好后，再替换成真正的事件台词。

## 6. 资产组织建议

代码已经开始按 cue 语义使用语音，但素材层目前仍大多按 phase 文件名存在。后续建议将“文件命名”与“语义 cue”明确绑定。

建议新增一层语义槽位概念：

- `lobby.intro`
- `lobby.instructions`
- `answering.prompt.long`
- `answering.prompt.short`
- `answering.all-answered-early`
- `scoring.rank-shift-big`
- `scoring.rank-shift-small`
- `scoring.no-correct`
- `scoring.everyone-correct`
- `finale.winner-reveal`

语音库管理上建议：

- `phase` 继续保留，方便理解流程
- 但 review、筛选、复生成员时，主分组逐步切到 `cue semantic id`
- 一个 cue 可以有多个 take / variant
- 一个 phase 可以引用多个不同 cue

## 7. 以后给其他游戏复用时的规则

每个新游戏尽量都复用下面的共享 contract：

- Server 继续只负责 `phase` 与规则真相
- Presentation 只负责演出与播放
- `snapshot -> events -> cue plan` 走共享 cue engine

每个游戏只需要自定义三样东西：

1. phase 列表
2. event 规则
3. cue 语义与素材映射

换句话说，复用边界应该是：

- 共享：cue engine、播放策略、review 流程、voice catalog 结构
- 游戏私有：phase 名称、事件条件、文案与素材

## 8. 下一步最值得做的三件事

1. 把 `tts-manifest.json` 从“按 phase 写脚本”升级成“按 cue 语义写脚本”。
2. 给 `voice-library` 目录增加 `cueId` 视角，而不仅是 `phase group`。
3. 在 Trivia 再补 3-5 个真正的事件型 cue：
   - `answering.all-answered-early`
   - `scoring.rank-shift-big`
   - `scoring.everyone-wrong`
   - `finale.last-place-first`
   - `reconnect.wait-briefly`

做到这一步后，Joyly 的导演系统就会从“可播放 phase 语音”升级成“可反应现场状态的游戏导演”。
