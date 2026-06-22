# Cosmic Trivia Audio Assets

把音频文件放到以下目录：

- `host/phases/`：固定流程主持人口播
- `audio/`：题干语音，按题目 id 命名
- `sfx/transitions/`：阶段切换与出场提示
- `sfx/countdown/`：倒计时和紧张提示
- `sfx/results/`：得分、排名、胜利
- `music/`：循环背景音乐。前端会读取这个文件夹里现有的音频文件，并随机循环播放。

当前试用的全局背景音乐：

- `music/bgm-trivia-time-chill-01.mp3`
- `music/bgm-trivia-time-chill-02.mp3`
- `music/bgm-trivia-cyber-gloss-01.mp3`
- `music/bgm-trivia-cyber-gloss-02.mp3`

阶段和文件建议命名见：

- `content/games/cosmic-trivia/AUDIO_SYSTEM.md`
- `content/games/cosmic-trivia/audio/audio-stage-map.json`
