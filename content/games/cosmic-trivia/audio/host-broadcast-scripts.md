# Cosmic Trivia Host Broadcast Scripts

这份脚本按新的 cue 结构整理：`phase / global / cross`。每个小节代表一个可录制或可生成的主持人语音槽位。

## Phase Cues

### `phase.preferences.selection.intro`

- 用途：玩家选择题量、分类或偏好时。
- 示例：`先选一下这一局怎么玩，题目数量和方向都在手机上决定。`

### `phase.round-prep.round.loading`

- 用途：偏好确认后，系统准备题目时。
- 示例：`正在把这一局的题目装进飞船，马上出发。`

### `phase.question-intro.question.next`

- 用途：下一题出现前。
- 示例：`下一题来了，注意看屏幕。`
- 示例：`准备接题，这一题有点意思。`

### `phase.answering.answer.open`

- 用途：玩家可以开始答题。
- 示例：`开始作答，请在手机上选答案。`
- 示例：`答案通道已经打开，别犹豫太久。`

### `phase.answering.answer.all-in`

- 用途：所有玩家提前答完。
- 示例：`所有人都答完了，直接看结果。`

### `phase.answer-lock.answer.locked`

- 用途：答案锁定。
- 示例：`答案锁定。`

### `phase.reveal.answer.positive`

- 用途：公布正确答案时的常规口播。
- 示例：`来看看正确答案。`

### `phase.reveal.answer.no-one-correct`

- 用途：无人答对。
- 示例：`这一题把所有人都难住了。`
- 示例：`居然没有人答对。`

### `phase.scoring.score.update`

- 用途：分数结算或排名更新。
- 示例：`分数正在更新。`

### `phase.between-questions.transition.next`

- 用途：题目之间的转场。
- 示例：`继续，下一题马上开始。`

### `phase.finale.result.incoming`

- 用途：正式公布最终结果前。
- 示例：`最终结果马上来了，先稳住呼吸。`

### `phase.post-game.result.outro`

- 用途：游戏结束后的收尾。
- 示例：`这一局结束，感谢大家参与。`

## Global Cues

### `global.score.hidden.started`

- 用途：最后 30% 题目开始隐藏分数。
- 示例：`从现在开始，分数先不公开，悬念留到最后。`

### `global.player.join.in`

- 用途：玩家加入，可以在合适的等待阶段插入。
- 示例：`有新玩家加入了，队伍更热闹了。`

### `global.game.default`

- 用途：全局兜底，不承担具体剧情信息。
- 示例：`这局继续，跟紧节奏。`

## Cross Cues

### `cross.player.idle.filler`

- 用途：等待玩家操作时的轻量填充。
- 示例：`还没操作的玩家，可以现在看一下手机。`

### `cross.network.delay.filler`

- 用途：短暂网络或加载等待。
- 示例：`信号正在穿过小行星带，马上回来。`

### `cross.stats.streak.detected`

- 用途：最终结果前或合适阶段插入匿名趣味统计。
- 示例：`有人已经连续答对好几题了，但我先不说是谁。`
