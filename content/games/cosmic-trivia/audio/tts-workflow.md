# Cosmic Trivia TTS Workflow

This is the simplest reliable pipeline for turning scripts into playable audio files.

## 1. Prepare the source text

- Keep one script line per file or per segment.
- Use short, spoken phrasing.
- Avoid long sentences, nested clauses, and rare words if you want clean TTS output.
- Keep a consistent tone across all phase scripts.

## 2. Choose the voice setup

- Pick one host voice for all phase broadcasts.
- Use the same voice settings across the whole set so the director feels coherent.
- If the provider supports it, keep speed, pitch, and style consistent.
- Use the same voice for all question title reads.

## 3. Generate the audio

- Generate one file per phase script.
- For repeated short prompts like `question-intro`, `answering`, `scoring`, and `next-question`, generate several variants and let the director rotate them.
- Use the naming pattern from `AUDIO_SYSTEM.md`.
- Start with `interest-selecting`, `deck-loading`, `question-intro`, `answering`, `scoring`, `next-question`, and `complete`.
- Then generate the question title voices for every enabled question in the pack.
- In this project, the batch generator reads `content/games/cosmic-trivia/audio/tts-manifest.json` and writes MP3 files into `public/games/cosmic-trivia/audio/host/phases/`.
- A second batch generator reads the question pack and writes question title MP3 files into `public/games/cosmic-trivia/audio/`.
- Run it with:

```bash
ELEVENLABS_API_KEY=your_key_here \
ELEVENLABS_VOICE_ID=your_voice_id_here \
npm run generate:cosmic-trivia-host-audio
```

- Add `--dry-run` to preview the job list.
- Add `--overwrite` if you want to regenerate files that already exist.
- For Eleven v3, use audio tags like `[excited]` and `[happily]`, plus punctuation and short phrases, to shape the delivery.
- The UI's `Creative` stability mode is approximated here with a lower `stability` value and expressive tags in the text.

## 4. Check the result

- Listen for weird pronunciation, clipped endings, and awkward pauses.
- If a line feels too long, rewrite the script before regenerating.
- Keep the volume and loudness similar across files.
- Trim silence at the start and end if the provider leaves extra space.

## 5. Normalize the files

- Export as `mp3`.
- Use a consistent sample rate and channel layout across the project.
- Rename the output to the final file name before placing it in `public/games/cosmic-trivia/audio/host/phases/`.

## 6. Wire it to the director

- Map each phase to its host voice file in `content/games/cosmic-trivia/audio/audio-stage-map.json`.
- Use `questionAudio` for the question title read.
- Let the server remain the source of truth for when the audio should play.
- The server-side director should stay responsible for phase timing; ElevenLabs is only the audio renderer.

## Recommended rollout order

1. Generate the host phase files first.
2. Then generate the question title files.
3. After that, add SFX and music beds.
4. Finally, hook the files into the playback logic and test the full round.
