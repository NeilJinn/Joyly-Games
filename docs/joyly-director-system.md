# Joyly 编导系统

这套系统把游戏流程拆成明确的 phase，并把“什么时候播语音”和“什么时候推进下一步”分开。

如果要看基于 Trivia 的 `phase + event + cue` 原型，请同时参考：

- `docs/joyly-reactive-director-prototype.md`

## 核心原则

- Server 是唯一的流程真相。
- 语音只负责提示和表演，不负责决定游戏结果。
- 某些 phase 在语音结束后推进，某些 phase 在倒计时结束后推进。
- 同一个意思可以准备多个语音版本，导演按 play count、题号、结果或随机种子挑选。

## 通用 phase 约定

- `timer` phase：有倒计时，语音可以在进入时播放，但 phase 结束由时间决定。
- `audio-advance` phase：语音播完后自动进入下一 phase。
- `hold` phase：停留在当前 phase，直到服务器显式结束或外部动作触发。

## 建议的数据

- `phase`
- `phaseStartedAt`
- `phaseDurationMs`
- `phaseEndsAt`
- `directorMessage`
- `playCount`
- `lastResolution`

## 通用音频流程

- `public/shared/director/flow.js` 提供共享导演底座。
- `public/games/<game>/audio/director-flow.js` 只写每个游戏自己的 phase 配置。
- `presentation.js` 负责按 phase 播放音频序列，并在最后一段结束后通知 server。
- `server.js` 负责接收音频结束信号，然后推进流程。

## Cosmic Trivia 的阶段例子

- 进房选择类型：`interest-selecting`
- 锁定选择后：`preferences-locked` -> `deck-loading`
- 题目前导语：`question-intro`
- 题目播报：`question-audio`
- 作答倒计时：`answering`
- 积分/排名反馈：`scoring`
- 下一题过渡：`next-question`
- 最终结尾：`finale-intro` -> `complete`
