# Cosmic Trivia Audio Assets

当前目录只保留一套主持人导演语音结构：`host/director/<scope>/<domain>/<eventPath...>/line-xx.mp3`。

## 目录边界

- `host/director/`：主持人导演语音，由 cue registry 驱动。
- `audio/`：题干语音，按题目 id 命名。
- `sfx/transitions/`：阶段切换与出场提示。
- `sfx/countdown/`：倒计时和紧张提示。
- `sfx/results/`：得分、排名、胜利。
- `music/`：循环背景音乐。

## Host Director 结构

- `host/director/phase/<phase>/<eventPath...>/line-01.mp3`
- `host/director/global/<domain>/<eventPath...>/line-01.mp3`
- `host/director/cross/<domain>/<eventPath...>/line-01.mp3`

示例：

- `host/director/phase/question-intro/question/next/line-01.mp3`
- `host/director/phase/answering/answer/all-in/line-01.mp3`
- `host/director/global/score/hidden/started/line-01.mp3`
- `host/director/cross/player/idle/filler/line-01.mp3`

## 真相来源

- `content/games/cosmic-trivia/director/cues.json` 定义 cue、文案、变体和文件路径。
- `scripts/build-cosmic-trivia-director-cues.js` 生成运行时 cue library。
- `public/games/cosmic-trivia/director/cue-library.generated.js` 是生成产物，不手写。
