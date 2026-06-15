# Cosmic Trivia Audio System

Cosmic Trivia 的主持人语音不再是“按脚本顺序硬播”的文件列表，而是一套可复用的导演 cue 系统。核心思想是：游戏状态发出 phase、global、cross 事件，语音库按同一套结构提供可选台词。

## 系统边界

这套规范只覆盖 `host director voice`。

- `questionAudio`：题干语音，仍由题库字段维护。
- `sfx`：转场、倒计时、得分、庆祝等声效。
- `music`：循环背景音乐。
- `host director voice`：由 cue registry 和 game director 触发。

## 统一结构

语音库和文件目录统一采用：

- `Cosmic Trivia > phase > <phase> > <eventPath...> > line-xx.mp3`
- `Cosmic Trivia > global > <domain> > <eventPath...> > line-xx.mp3`
- `Cosmic Trivia > cross > <domain> > <eventPath...> > line-xx.mp3`

文件路径镜像语义结构：

- `public/games/cosmic-trivia/audio/host/director/phase/question-intro/question/next/line-01.mp3`
- `public/games/cosmic-trivia/audio/host/director/global/score/hidden/started/line-01.mp3`
- `public/games/cosmic-trivia/audio/host/director/cross/player/idle/filler/line-01.mp3`

## Scope 定义

- `phase`：阶段内的主线导演语音，例如进入答题、公布答案、更新分数。
- `global`：整局范围的状态事件，例如玩家加入、分数隐藏开始、游戏兜底语音。
- `cross`：可跨阶段插入的导演语音，例如等待、网络延迟、连对统计、气氛填充。

`event` 不再作为顶层 scope 使用。事件路径统一放在 `eventPath` 里。

## Cue Key

每条语音都有唯一 `cueKey`：

- `phase.<phase>.<eventPath...>`
- `global.<domain>.<eventPath...>`
- `cross.<domain>.<eventPath...>`

示例：

- `phase.question-intro.question.next`
- `phase.answering.answer.all-in`
- `global.score.hidden.started`
- `cross.stats.streak.detected`

`cueKey` 是真相来源。文件名只表示变体序号。

## Registry 与生成

编辑入口：

- `content/games/cosmic-trivia/director/cues.json`

生成入口：

- `npm run build:trivia-director-cues`

生成产物：

- `public/games/cosmic-trivia/director/cue-library.generated.js`

生成产物不要手写修改。

## Fallback

运行时按下面顺序找语音：

1. 精确 cue。
2. 当前 domain 的默认 fallback。
3. `global.game.default`。
4. 静默。

静默是正常 fallback，不能阻塞游戏。

## Trivia Phase

当前 Trivia 官方阶段：

- `game-setup`
- `preferences`
- `round-prep`
- `question-intro`
- `question-read`
- `answering`
- `answer-lock`
- `reveal`
- `scoring`
- `between-questions`
- `final-hype`
- `finale`
- `post-game`

## 当前运行时 Cue

- `phase.preferences.selection.intro`
- `phase.round-prep.round.loading`
- `phase.question-intro.question.next`
- `phase.answering.answer.open`
- `phase.answering.answer.all-in`
- `phase.answer-lock.answer.locked`
- `phase.reveal.answer.positive`
- `phase.reveal.answer.no-one-correct`
- `phase.scoring.score.update`
- `phase.between-questions.transition.next`
- `phase.finale.result.incoming`
- `phase.post-game.result.outro`
- `global.score.hidden.started`

## 可扩展 Cue

- `global.player.join.in`
- `cross.player.idle.filler`
- `cross.network.delay.filler`
- `cross.stats.streak.detected`

新增 cue 时，先加 registry，再放音频，再生成 cue library。
