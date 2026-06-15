# Cosmic Trivia TTS Workflow

这份流程只负责 `host director voice`。题干语音、SFX、BGM 分开维护。

## 1. 先选 Cue，再写台词

每条主持人语音必须挂到一个明确的 cue：

- `phase.<phase>.<eventPath...>`
- `global.<domain>.<eventPath...>`
- `cross.<domain>.<eventPath...>`

示例：

- `phase.preferences.selection.intro`
- `phase.answering.answer.all-in`
- `global.score.hidden.started`
- `cross.player.idle.filler`

不要先写一句台词，再临时塞进目录。

## 2. Cue Registry 是真相来源

编辑入口：

- `content/games/cosmic-trivia/director/cues.json`

每个 cue 至少包含：

- `cueKey`
- `scope`
- `domain`
- `eventPath`
- `lines`
- `variants`

`cueKey` 必须等于 `[scope, domain, ...eventPath].join(".")`。

## 3. 文件落点

主持人导演语音统一写入：

- `public/games/cosmic-trivia/audio/host/director/phase/<phase>/<eventPath...>/line-01.mp3`
- `public/games/cosmic-trivia/audio/host/director/global/<domain>/<eventPath...>/line-01.mp3`
- `public/games/cosmic-trivia/audio/host/director/cross/<domain>/<eventPath...>/line-01.mp3`

文件名只表示同一个 cue 下的第几个变体：

- `line-01.mp3`
- `line-02.mp3`
- `line-03.mp3`

业务含义写在 cue registry，不写进文件名。

## 4. 生成顺序

推荐先补齐当前运行时会直接使用的 cue：

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

再扩展全局和跨阶段插入 cue：

- `global.player.join.in`
- `cross.player.idle.filler`
- `cross.network.delay.filler`
- `cross.stats.streak.detected`

## 5. 运行时绑定原则

运行时永远按 `cueKey` 找音频，不从旧文件名或旧阶段名反推。

查找顺序：

1. 精确 cue。
2. 同 domain 的默认 fallback cue。
3. `global.game.default`。
4. 静默。

静默是合法结果，不能阻塞游戏流程。

## 6. 检查清单

- `cueKey`、`scope`、`domain`、`eventPath` 是否一致。
- `variants[].path` 是否指向新的 `host/director/<scope>/...` 目录。
- 文案是否没有泄露隐藏分数、最终排名等敏感信息。
- 同一个 cue 的多个 `line-xx.mp3` 是否真的有表达差异。
- 修改后运行 `npm run build:trivia-director-cues`。
