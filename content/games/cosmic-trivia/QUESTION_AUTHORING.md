# Cosmic Trivia Authoring

Edit the Excel source of truth:

- `content/games/cosmic-trivia/authoring/questions.xlsx`

Build the runtime pack with:

```bash
npm run build:trivia
```

That generates:

- `content/games/cosmic-trivia/question-packs/core.json`

Excel columns:

- `id`
- `category`
- `tags`
- `difficulty`
- `question`
- `answerA`
- `answerB`
- `answerC`
- `answerD`
- `correctAnswer`
- `fact`
- `questionAudio`
- `enabled`

Notes:

- `tags` uses comma-separated text in the sheet.
- `correctAnswer` must be `a`, `b`, `c`, or `d`.
- `enabled=false` keeps a row out of the generated pack.
- Categories, tags, and difficulties are derived from the spreadsheet content. There is no manifest to maintain.

Audio system files:

- `content/games/cosmic-trivia/AUDIO_SYSTEM.md`
- `content/games/cosmic-trivia/audio/audio-stage-map.json`
- `public/games/cosmic-trivia/audio/`

Audio responsibilities:

- `questionAudio` is the per-question prompt voiceover.
- Host phase voice and shared sound effects live under `public/games/cosmic-trivia/audio/`.
