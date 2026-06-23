# Cosmic Trivia — AI Agent Content Generation Guide

This document is written for AI agents. Read it before helping with question authoring, voice line writing, or game director content in the Cosmic Trivia project.

---

## 1. System Overview

Cosmic Trivia is a party game with a server-authoritative phase model. Three layers:

- **Server** (`server/games/cosmic-trivia/`) — owns game truth: phases, scoring, question selection
- **Director** (`src/lib/director/`, `public/shared/director/`) — drives audio cues and visual effects
- **Content** (`content/games/cosmic-trivia/`) — questions, audio manifests, question packs

The single source of truth for all authored content is **SQLite**:

```
content/voice-library/trivia-content.sqlite
```

This database stores both trivia questions and all host voice cues in the same file.

---

## 2. Question Authoring

### 2.1 SQLite schema — `questions` table

```sql
CREATE TABLE questions (
  id             TEXT PRIMARY KEY,        -- e.g. "core-science-010"
  game_id        TEXT NOT NULL,           -- always "cosmic-trivia"
  category       TEXT NOT NULL,           -- science, history, space, general, ...
  tags_json      TEXT NOT NULL,           -- JSON array: ["planets","solar-system"]
  difficulty     TEXT NOT NULL,           -- easy, medium, hard
  question       TEXT NOT NULL,           -- the question text read aloud by host
  answer_a       TEXT NOT NULL,
  answer_b       TEXT NOT NULL,
  answer_c       TEXT NOT NULL,
  answer_d       TEXT NOT NULL,
  correct_answer TEXT NOT NULL,           -- "a", "b", "c", or "d"
  fact           TEXT NOT NULL,           -- shown after reveal; 1–2 sentences
  question_audio TEXT NOT NULL,           -- "/games/cosmic-trivia/audio/{id}-question.mp3"
  answer_audio   TEXT NOT NULL DEFAULT '',
  enabled        INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
```

### 2.2 ID naming convention

Format: `core-{category}-{NNN}` where NNN is zero-padded to 3 digits.

```
core-science-001
core-science-002
core-history-001
core-space-001
```

To find the next available ID for a category, query:
```sql
SELECT id FROM questions WHERE category = 'science' AND id LIKE 'core-science-%';
```
Find the max trailing number, increment by 1.

### 2.3 Audio path convention

```
question_audio = "/games/cosmic-trivia/audio/{id}-question.mp3"
```

Example: `core-science-010` → `/games/cosmic-trivia/audio/core-science-010-question.mp3`

The mp3 file lives at: `public/games/cosmic-trivia/audio/{id}-question.mp3`

### 2.4 Question quality rules

- Question must be answerable with 4 distinct, plausible options
- All 4 answer options must be roughly equal in length and plausibility
- `fact` should be 1–2 sentences, adding genuine insight beyond just restating the answer
- Questions should be party-friendly: no trick questions, no ambiguous wording
- Difficulty: easy = general knowledge, medium = some learning needed, hard = specialist knowledge
- ElevenLabs reads the question text aloud. Write it for natural speech. Avoid symbols, footnotes, or special characters.

### 2.5 Existing categories and their cue coverage

The following categories have registered voice cues for the `interest-reveal` phase:

```
science, general, space, history, geography, nature, movies, sports
```

If you add a **new category**, you must also:
1. Add EMOJI entry to `src/components/games/cosmic-trivia/PreferencesPicker.tsx` → `EMOJI` map
2. Add EMOJI entry to `src/pages/games/cosmic-trivia/BigScreenPage.tsx` → `CATEGORY_EMOJI` map
3. Register 3 new `interest-reveal` voice cues (rank-1, rank-2, rank-3) in SQLite for that category (see Section 3)
4. Generate TTS for those cues in the voice management tool

### 2.6 How to add new questions (workflow)

The script reads question JSON from **stdin** — no temporary file needed.

Pipe a JSON array directly into the script:

```bash
python3 scripts/add_trivia_questions.py << 'EOF'
[
  {
    "category": "science",
    "tags": ["physics", "light"],
    "difficulty": "medium",
    "question": "What is the speed of light in a vacuum?",
    "answerA": "300,000 km/s",
    "answerB": "150,000 km/s",
    "answerC": "450,000 km/s",
    "answerD": "200,000 km/s",
    "correctAnswer": "a",
    "fact": "Light travels at approximately 299,792 km/s, making it the fastest thing in the universe."
  }
]
EOF
```

Omit `id` and `questionAudio` — they are auto-assigned.

Add `--dry-run` to preview without writing:

```bash
python3 scripts/add_trivia_questions.py --dry-run << 'EOF'
[{...}]
EOF
```

The script will:
1. Validate the questions
2. Auto-assign IDs (`core-{category}-{NNN}`) and audio paths
3. Insert into SQLite `questions` table
4. Run `npm run build:trivia` to regenerate `core.json`
5. Register question audio cues in the voice library (status: unreviewed)

After running, open `python3 tools/trivia_content_manager.py` to generate TTS for new question audio.

### 2.7 Build pipeline

```
questions table (SQLite)
    ↓ npm run build:trivia
content/games/cosmic-trivia/question-packs/core.json
    ↓ server reads at runtime
selectRoundQuestions() in server/games/cosmic-trivia/question-selector.js
```

The build script is `scripts/build-cosmic-trivia-pack.js`. Run it any time you change question data.

---

## 3. Voice / TTS System

### 3.1 Architecture

```
voice_cues (SQLite) ← source of truth for what needs to be voiced
    ↓ trivia_content_manager.py
ElevenLabs API → mp3 files → public/games/cosmic-trivia/audio/host/director/...
    ↓ npm run build:trivia-director-cues
src/lib/director/cosmic-trivia-cue-library.generated.ts  (TS, client)
public/games/cosmic-trivia/director/cue-library.generated.js  (JS, server)
```

### 3.2 SQLite schema — 5 tables

**`voice_cues`** — one row per cue (the logical slot):
```sql
cue_key         TEXT PRIMARY KEY  -- "phase.interest-reveal.selection.rank-1.science"
game_id         TEXT              -- "cosmic-trivia"
project_title   TEXT              -- human label for grouping in UI, e.g. "兴趣播报"
group_id        TEXT              -- sub-group within project_title
title           TEXT              -- short label for this specific cue
scope           TEXT              -- first segment of cue_key: "phase", "cross", "global", "question"
domain          TEXT              -- second segment: "interest-reveal", "answering", etc.
event_path_json TEXT              -- JSON array of remaining path segments
director_triggered INTEGER        -- 1 if fired by a director trigger rule, 0 if rule-based
updated_at      TEXT
```

**`voice_lines`** — one row per audio variant of a cue:
```sql
line_id         TEXT PRIMARY KEY  -- e.g. "phase-interest-reveal-rank1-science-v1"
cue_key         TEXT              -- FK → voice_cues.cue_key
game_id         TEXT
kind            TEXT              -- always "line"
file_name       TEXT              -- "line-01.mp3"
audio_path      TEXT              -- "/games/cosmic-trivia/audio/host/director/phase/interest-reveal/..."
source_text     TEXT              -- TTS text sent to ElevenLabs
source_text_hash TEXT             -- SHA-256 of source_text
tone            TEXT              -- "neutral", "excited", "warm", etc.
audience        TEXT              -- "all"
visibility      TEXT              -- "public"
active          INTEGER           -- 1
updated_at      TEXT
```

**`voice_review_state`** — tracks TTS generation status:
```sql
line_id         TEXT PRIMARY KEY  -- FK → voice_lines.line_id
status          TEXT              -- "unreviewed" | "pending" | "approved"
tags_json       TEXT              -- JSON array of tags, e.g. ["regenerate"]
transcript      TEXT              -- actual transcript after generation
updated_at      TEXT
```

**`voice_assets`** — tracks file existence:
```sql
line_id         TEXT PRIMARY KEY
audio_path      TEXT
file_hash       TEXT
file_size       INTEGER
text_hash       TEXT
asset_status    TEXT              -- "ok" | "missing" | "stale"
checked_at      TEXT
```

**`director_trigger_rules`** — optional: auto-fire rules:
```sql
cue_key, trigger_mode, phase, event_key, priority, enabled
```

### 3.3 Cue key format

```
{scope}.{domain}.{eventPath...}
```

Examples:
```
phase.interest-reveal.selection.rank-1.science
phase.answering.answer.open
phase.reveal.answer.only-two-correct
cross.stats.streak.3-question-right-streak
global.connector.and
global.connector.lastly
question.core-science-010.read
```

Rules:
- `scope` = `phase` | `cross` | `global` | `question`
- `domain` = the phase name (for phase scope) or the domain concept
- `event_path` = dot-separated remaining segments describing the specific event

### 3.4 Audio file path convention

Host/director audio:
```
public/games/cosmic-trivia/audio/host/director/{scope}/{domain}/{eventPath.../}/{file_name}
```

Example for `phase.interest-reveal.selection.rank-1.science`:
```
public/games/cosmic-trivia/audio/host/director/phase/interest-reveal/selection/rank-1/science/line-01.mp3
```

Question audio:
```
public/games/cosmic-trivia/audio/{id}-question.mp3
```

### 3.5 ElevenLabs v3 TTS text guidelines

The project uses ElevenLabs v3 (`eleven_v3` model). Write `source_text` in **English**.

Supported emotion/direction tags (place inline in text):
```
[chuckles]   [laughs]     [sighs]      [gasps]
[thoughtful] [excited]    [woo]        [surprised]
[happy]      [curious]    [whispers]   [clears throat]
```

Guidelines:
- Match the emotion tag to the actual line content. Don't overuse any single tag.
- Not every line needs a tag. Natural delivery is fine without them.
- Tags go at the START of the sentence or mid-sentence before the relevant word/phrase.
- Lines should be 5–25 words. Very short lines can feel abrupt; very long ones are hard to control tonally.
- Each cue variant should have distinctly different wording, not just synonyms. Different sentence structure, different angle.
- Developer notes (`title`, `group_id`, `project_title` fields) can be in Chinese — only you see those.

Example `interest-reveal` cue (rank-1 for science):
```
source_text: "[excited] Science nerds, this is your moment — looks like science is the crowd favorite tonight!"
```

### 3.6 How to register a new voice cue (workflow)

Insert rows into all 5 tables. Use this pattern (Python):

```python
import sqlite3, hashlib, json
from datetime import datetime, timezone

SQLITE_PATH = "content/voice-library/trivia-content.sqlite"
now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")

def text_hash(text):
    return hashlib.sha256(str(text or "").encode("utf-8")).hexdigest()

cue_key = "phase.interest-reveal.selection.rank-1.science"
line_id = "phase-interest-reveal-rank1-science-v1"
audio_path = "/games/cosmic-trivia/audio/host/director/phase/interest-reveal/selection/rank-1/science/line-01.mp3"
source_text = "[excited] Science nerds, this is your moment — looks like science is the crowd favorite tonight!"

with sqlite3.connect(SQLITE_PATH) as conn:
    conn.execute("""INSERT OR IGNORE INTO voice_cues
        (cue_key, game_id, project_title, group_id, title, scope, domain, event_path_json, updated_at, director_triggered)
        VALUES (?,?,?,?,?,?,?,?,?,?)""",
        (cue_key, "cosmic-trivia", "兴趣播报", "interest-reveal.rank-1",
         "rank-1 · science", "phase", "interest-reveal",
         json.dumps(["selection","rank-1","science"]), now, 0))

    conn.execute("""INSERT OR IGNORE INTO voice_lines
        (line_id, cue_key, game_id, kind, file_name, audio_path, source_text, source_text_hash, tone, audience, visibility, active, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (line_id, cue_key, "cosmic-trivia", "line", "line-01.mp3", audio_path,
         source_text, text_hash(source_text), "excited", "all", "public", 1, now))

    conn.execute("""INSERT OR IGNORE INTO voice_review_state
        (line_id, status, tags_json, transcript, updated_at)
        VALUES (?,?,?,?,?)""",
        (line_id, "unreviewed", "[]", "", now))

    conn.execute("""INSERT OR IGNORE INTO voice_assets
        (line_id, audio_path, file_hash, file_size, text_hash, asset_status, checked_at)
        VALUES (?,?,?,?,?,?,?)""",
        (line_id, audio_path, None, None, text_hash(source_text), "missing", now))
```

After inserting, run:
```bash
npm run build:trivia-director-cues
```
This regenerates both:
- `src/lib/director/cosmic-trivia-cue-library.generated.ts` (client)
- `public/games/cosmic-trivia/director/cue-library.generated.js` (server)

Then open `python3 tools/trivia_content_manager.py` to generate TTS.

---

## 4. Game Director System

### 4.1 Phase list (in order)

```
game-setup → preferences → interest-reveal → round-prep →
question-intro → question-read → answering → answer-lock →
reveal → scoring → between-questions (loops) →
final-hype (loops) → finale → post-game
```

Phase definitions live in two mirrored files:
- `public/shared/director/cosmic-trivia-phases.js` (server + shared)
- `src/lib/director/cosmic-trivia-phases.ts` (client TypeScript)

### 4.2 Phase kinds

| Kind | Advances when |
|------|---------------|
| `hold` | Never auto-advances (requires explicit trigger) |
| `timer` | Timer expires |
| `audio-advance` | Client sends "ended" audio status |
| `timer-and-audio` | Timer expires AND audio not playing |

### 4.3 Director cue rules (reactive director)

Client-side rules in `src/lib/director/cosmic-trivia-director.ts`:

```typescript
{
  id: "phase:round-prep",
  when: r => r.phaseChanged && r.phase === "round-prep",
  select: ctx => ({
    id: "round-prep.loading",
    replayKey: `round-prep:${ctx.phase}`,
    audio: cueAudio("phase.round-prep.round.loading", seed),
  }),
}
```

- `when` — condition on `ReactiveDirectorRuntime` (has `phase`, `phaseChanged`, `previousSnapshot`, `nextSnapshot`)
- `select` — returns a partial `NormalizedCue` with `audio` (cue key string) or `null` to skip
- `audio` is a cue key string; the system resolves it to file paths via the generated cue library

### 4.4 The interest-reveal phase (special case)

This phase does NOT use the reactive director. It has its own `useEffect` in `src/hooks/useCosmicTriviaDirector.ts` that:
1. Reads `trivia.topCategories` from public state
2. Plays the audio sequence: intro → rank-1/{cat} → "and" → rank-2/{cat} → "lastly" → rank-3/{cat}
3. Simultaneously preloads all round audio assets (`trivia.upcomingAudioUrls`)
4. Sends "ended" to server only after both audio and preloading complete

Visual animation is driven by `interestRevealStep` (0–3) returned from `useCosmicTriviaDirector`.

### 4.5 How to add a new phase (checklist)

1. **`public/shared/director/cosmic-trivia-phases.js`** — add phase entry with `kind`
2. **`src/lib/director/cosmic-trivia-phases.ts`** — mirror the entry
3. **`server/games/cosmic-trivia/flow.js`** — add to `PHASE_TRANSITIONS`, add handling block in `advanceCosmicTrivia` if needed
4. **`src/lib/director/cosmic-trivia-director.ts`** — add reactive director rule if phase plays audio
5. **`src/hooks/useCosmicTriviaDirector.ts`** — add visual cue state if needed
6. **`src/pages/games/cosmic-trivia/BigScreenPage.tsx`** — add phase UI block
7. **`src/pages/games/cosmic-trivia/PhonePage.tsx`** — add phone UI block
8. Register any new voice cues in SQLite, run build, generate TTS

### 4.6 Server public state

The server exposes game state to clients via `publicCosmicTriviaState()` in `server/games/cosmic-trivia/state.js`.

Key fields relevant to content:
- `phase` — current phase name
- `topCategories: string[]` — computed from player preference votes, exposed during `interest-reveal`
- `upcomingAudioUrls: string[]` — full preload manifest (question audio + round director cues), exposed during `interest-reveal` and `round-prep`
- `currentQuestion` — sanitized question object (no correct answer exposed during `answering`)

---

## 5. Key File Map

```
content/voice-library/trivia-content.sqlite       — ALL source of truth (questions + voice cues)

scripts/add_trivia_questions.py                  — add new questions (SQLite + voice cue registration)
scripts/build-cosmic-trivia-pack.js              — SQLite → core.json
scripts/build-cosmic-trivia-director-cues.js     — SQLite → generated cue library files

src/lib/director/cosmic-trivia-cue-library.generated.ts   — auto-generated, do not edit
public/games/cosmic-trivia/director/cue-library.generated.js  — auto-generated, do not edit

src/lib/director/cosmic-trivia-director.ts       — reactive director rules
src/lib/director/cosmic-trivia-phases.ts         — phase definitions (TypeScript)
public/shared/director/cosmic-trivia-phases.js   — phase definitions (JS, shared with server)

src/hooks/useCosmicTriviaDirector.ts             — director hook (audio playback + visual state)
src/pages/games/cosmic-trivia/BigScreenPage.tsx  — big screen UI per phase
src/pages/games/cosmic-trivia/PhonePage.tsx      — phone UI per phase

server/games/cosmic-trivia/flow.js               — phase transitions + advance logic
server/games/cosmic-trivia/state.js              — public state projection
server/games/cosmic-trivia/question-selector.js  — weighted question selection by player votes

tools/trivia_content_manager.py                 — voice management UI (run with python3)
```

---

## 6. Common Tasks Quick Reference

### Generate and add questions
```bash
# Pipe JSON directly — no file needed
python3 scripts/add_trivia_questions.py << 'EOF'
[{"category": "science", "tags": ["..."], "difficulty": "medium", "question": "...", "answerA": "...", "answerB": "...", "answerC": "...", "answerD": "...", "correctAnswer": "a", "fact": "..."}]
EOF

# Then open voice tool to generate TTS:
python3 tools/trivia_content_manager.py
```

### Add a new voice cue
```python
# Insert into SQLite (see Section 3.6 for full pattern)
# Then:
npm run build:trivia-director-cues
python3 tools/trivia_content_manager.py  # generate TTS
```

### Rebuild after any content change
```bash
npm run build:trivia               # regenerates core.json from SQLite questions
npm run build:trivia-director-cues # regenerates cue library from SQLite voice_cues
```

### Check what's in the database
```bash
python3 -c "
import sqlite3
conn = sqlite3.connect('content/voice-library/trivia-content.sqlite')
conn.row_factory = sqlite3.Row
print('Questions:', conn.execute('SELECT COUNT(*) FROM questions').fetchone()[0])
print('Voice cues:', conn.execute('SELECT COUNT(*) FROM voice_cues').fetchone()[0])
print('Voice lines:', conn.execute('SELECT COUNT(*) FROM voice_lines').fetchone()[0])
print('Missing audio:', conn.execute(\"SELECT COUNT(*) FROM voice_assets WHERE asset_status='missing'\").fetchone()[0])
"
```
