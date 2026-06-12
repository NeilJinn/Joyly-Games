# Cosmic Trivia Audio System

这套结构把 Trivia 的声音拆成三层：

- `主持人语音`：固定流程提示，例如“请选择题目偏好”“请看题”“公布答案”
- `题目语音`：每道题自己的题干语音，沿用题库里的 `questionAudio`
- `声效`：转场、倒计时、答对、答错、结算等通用反馈

## 资源目录

- `public/games/cosmic-trivia/audio/host/phases/`
  - 放系统阶段主持人口播
- `public/games/cosmic-trivia/audio/`
  - 放题目标题语音，按题目 id 命名
- `public/games/cosmic-trivia/audio/sfx/transitions/`
  - 放进入下一阶段时的转场声
- `public/games/cosmic-trivia/audio/sfx/countdown/`
  - 放答题阶段的倒计时、紧张提示
- `public/games/cosmic-trivia/audio/sfx/results/`
  - 放答对、答错、计分、冠军揭晓
- `public/games/cosmic-trivia/audio/music/`
  - 放可循环的 BGM

## 阶段建议

### `interest-selecting`

- 主持人语音：欢迎、提示玩家在手机上选择偏好
- 声效：轻量开场提示音
- BGM：轻松等待态循环

### `preferences-locked`

- 主持人语音：偏好已锁定，马上开始
- 声效：确认/锁定提示音

### `deck-loading`

- 主持人语音：正在抽取题目或准备题组
- 声效：短转场、加载感 sweep

### `question-intro`

- 主持人语音：请看题 / 第一题 / 下一题来了
- 声效：题目登场提示音
- 备注：这一类高频短句建议准备多个版本，避免重复感太强

### `question-audio`

- 主播放内容：每道题自己的题干语音
- 备注：这是题库里的 `questionAudio`
- 声效：尽量不叠加太强的效果，避免遮挡题干

### `answering`

- 主持人语音：请在手机上作答
- 声效：开始答题提示音、倒计时 warning、最后 5 秒 danger
- BGM：紧张答题循环

### `scoring`

- 主持人语音：加分结算 / 排名变化
- 声效：得分、上升名次、榜单刷新
- 备注：如果没人答对，可以走幽默版语音；如果有人得分，可以走鼓励版语音

### `next-question`

- 主持人语音：准备下一题
- 声效：短转场

### `complete`

- 主持人语音：本局结束、公布冠军、感谢参与
- 声效：胜利、掌声、收尾
- BGM：结算/庆祝循环

## 命名建议

- 阶段主持人语音：`phase-<phase-name>-<variant>.mp3`
  - 例：`phase-question-intro-01.mp3`
- 通用声效：`sfx-<group>-<purpose>.mp3`
  - 例：`sfx-countdown-warning.mp3`
- 题干语音：沿用题目 id
  - 例：`core-space-001-question.mp3`

## 接入优先级

1. 题目专属音频优先于通用主持人口播
2. 主持人语音优先于强声效
3. 倒计时声效只在 `answering` 阶段触发
4. `question-audio` 播放题库里的题干语音

机器可读映射见：

- `content/games/cosmic-trivia/audio/audio-stage-map.json`
- `content/games/cosmic-trivia/audio/host-broadcast-scripts.md`
- `content/games/cosmic-trivia/audio/tts-workflow.md`
- `content/games/cosmic-trivia/audio/tts-manifest.json`

Playback:

- The host presentation now auto-plays the matching phase audio when `cosmic-trivia` changes phases.
- Phase audio lives in `public/games/cosmic-trivia/audio/host/phases/`.
- The question/answer voiceovers can be wired in later without changing the phase director structure. For now, the director reuses a single placeholder clip.
