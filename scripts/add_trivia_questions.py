#!/usr/bin/env python3
"""
Add new trivia questions to questions.xlsx and register them in the voice library.

Usage:
  python3 scripts/add_trivia_questions.py --input path/to/new_questions.json
  python3 scripts/add_trivia_questions.py --input path/to/new_questions.json --dry-run

Input JSON format — array of question objects:
  [
    {
      "category": "science",
      "tags": ["planets", "space"],
      "difficulty": "easy",
      "question": "Which planet has the most moons?",
      "answerA": "Jupiter",
      "answerB": "Saturn",
      "answerC": "Neptune",
      "answerD": "Uranus",
      "correctAnswer": "b",
      "fact": "Saturn has 146 confirmed moons, the most of any planet."
    }
  ]

Fields "id" and "questionAudio" are auto-assigned if omitted.
"""

import argparse
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
XLSX_PATH = PROJECT_ROOT / "content" / "games" / "cosmic-trivia" / "authoring" / "questions.xlsx"
SQLITE_PATH = PROJECT_ROOT / "content" / "voice-library" / "voice-library.sqlite"
GAME_ID = "cosmic-trivia"

EXCEL_HEADERS = [
    "id", "category", "tags", "difficulty", "question",
    "answerA", "answerB", "answerC", "answerD", "correctAnswer",
    "fact", "questionAudio", "answerAudio", "enabled",
]


# ── ID management ─────────────────────────────────────────────────────────────

def get_existing_ids(ws) -> set[str]:
    ids = set()
    for row in ws.iter_rows(min_row=2, values_only=True):
        cell_id = str(row[0] or "").strip()
        if cell_id:
            ids.add(cell_id)
    return ids


def next_id_for_category(category: str, existing_ids: set[str]) -> str:
    pattern = re.compile(rf"^core-{re.escape(category)}-(\d+)$")
    max_num = 0
    for qid in existing_ids:
        m = pattern.match(qid)
        if m:
            max_num = max(max_num, int(m.group(1)))
    return f"core-{category}-{max_num + 1:03d}"


# ── Validation ────────────────────────────────────────────────────────────────

REQUIRED_FIELDS = ["category", "tags", "difficulty", "question",
                   "answerA", "answerB", "answerC", "answerD", "correctAnswer", "fact"]

def validate_question(q: dict, index: int) -> list[str]:
    errors = []
    label = f"Question {index + 1}"
    for field in REQUIRED_FIELDS:
        if not q.get(field):
            errors.append(f"{label}: missing '{field}'")
    ca = str(q.get("correctAnswer", "")).strip().lower()
    if ca not in ("a", "b", "c", "d"):
        errors.append(f"{label}: correctAnswer must be a/b/c/d, got '{ca}'")
    if not isinstance(q.get("tags"), list) or not q["tags"]:
        errors.append(f"{label}: 'tags' must be a non-empty list")
    return errors


# ── Excel append ──────────────────────────────────────────────────────────────

def append_to_excel(questions: list[dict], dry_run: bool) -> None:
    import openpyxl
    wb = openpyxl.load_workbook(XLSX_PATH)
    ws = wb.active

    for q in questions:
        ws.append([
            q["id"],
            q["category"],
            ", ".join(q["tags"]),
            q["difficulty"],
            q["question"],
            q["answerA"],
            q["answerB"],
            q["answerC"],
            q["answerD"],
            q["correctAnswer"].lower(),
            q["fact"],
            q["questionAudio"],
            q.get("answerAudio", ""),
            True,
        ])

    if not dry_run:
        wb.save(XLSX_PATH)
        print(f"  Saved {len(questions)} new row(s) to {XLSX_PATH.name}")
    else:
        print(f"  [dry-run] Would append {len(questions)} row(s) to {XLSX_PATH.name}")


# ── Build ─────────────────────────────────────────────────────────────────────

def run_build(dry_run: bool) -> None:
    if dry_run:
        print("  [dry-run] Would run: npm run build:trivia")
        return
    result = subprocess.run(
        ["npm", "run", "build:trivia"],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print("  build:trivia FAILED:")
        print(result.stderr)
        sys.exit(1)
    # Extract summary line
    for line in result.stdout.splitlines():
        if line.strip():
            print(f"  {line.strip()}")


# ── Voice library SQLite sync ─────────────────────────────────────────────────

def text_hash(text: str) -> str:
    return hashlib.sha256(str(text or "").encode("utf-8")).hexdigest()


def register_in_sqlite(questions: list[dict], dry_run: bool) -> None:
    import sqlite3

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    added = 0
    skipped = 0

    with sqlite3.connect(SQLITE_PATH) as conn:
        conn.row_factory = sqlite3.Row
        for q in questions:
            qid = q["id"]
            cue_key = f"question.{qid}.read"
            line_id = f"{qid}-line-01"

            # Skip if already registered
            exists = conn.execute(
                "SELECT 1 FROM voice_cues WHERE cue_key = ?", (cue_key,)
            ).fetchone()
            if exists:
                skipped += 1
                continue

            if dry_run:
                print(f"  [dry-run] Would register: {cue_key}")
                added += 1
                continue

            category = q["category"]
            short_title = q["question"][:60] + ("…" if len(q["question"]) > 60 else "")
            source_text = q["question"]
            audio_path = q["questionAudio"]
            file_name = Path(audio_path).name
            event_path = json.dumps([qid])

            conn.execute(
                """INSERT INTO voice_cues
                   (cue_key, game_id, project_title, group_id, title, scope, domain,
                    event_path_json, updated_at, director_triggered)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (cue_key, GAME_ID, "题目朗读", f"questions.{category}",
                 short_title, "question", "read", event_path, now, 0),
            )
            conn.execute(
                """INSERT INTO voice_lines
                   (line_id, cue_key, game_id, kind, file_name, audio_path, source_text,
                    source_text_hash, tone, audience, visibility, active, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (line_id, cue_key, GAME_ID, "line", file_name, audio_path,
                 source_text, text_hash(source_text), "neutral", "all", "public", 1, now),
            )
            conn.execute(
                """INSERT INTO voice_review_state
                   (line_id, status, tags_json, transcript, updated_at)
                   VALUES (?, ?, ?, ?, ?)""",
                (line_id, "unreviewed", "[]", "", now),
            )
            conn.execute(
                """INSERT INTO voice_assets
                   (line_id, audio_path, file_hash, file_size, text_hash, asset_status, checked_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (line_id, audio_path, None, None, text_hash(source_text), "missing", now),
            )
            added += 1

    if dry_run:
        if skipped:
            print(f"  [dry-run] Would skip {skipped} already-registered cue(s)")
    else:
        print(f"  Registered {added} new cue(s) in voice library" +
              (f", skipped {skipped} already present" if skipped else ""))


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Add trivia questions to xlsx + voice library")
    parser.add_argument("--input", required=True, help="Path to JSON file with new questions")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: input file not found: {input_path}")
        sys.exit(1)

    with open(input_path, encoding="utf-8") as f:
        raw = json.load(f)

    if not isinstance(raw, list):
        print("Error: input JSON must be an array of question objects")
        sys.exit(1)

    # Validate
    all_errors = []
    for i, q in enumerate(raw):
        all_errors.extend(validate_question(q, i))
    if all_errors:
        print("Validation errors:")
        for e in all_errors:
            print(f"  {e}")
        sys.exit(1)

    # Read existing IDs from xlsx
    import openpyxl
    wb = openpyxl.load_workbook(XLSX_PATH)
    ws = wb.active
    existing_ids = get_existing_ids(ws)

    # Assign IDs and audio paths
    for q in raw:
        if not q.get("id"):
            q["id"] = next_id_for_category(q["category"], existing_ids)
        existing_ids.add(q["id"])
        if not q.get("questionAudio"):
            q["questionAudio"] = f"/games/cosmic-trivia/audio/{q['id']}-question.mp3"

    print(f"\nAdding {len(raw)} question(s):")
    for q in raw:
        print(f"  {q['id']}  [{q['category']}]  {q['question'][:55]}…")

    print("\n1. Appending to Excel…")
    append_to_excel(raw, args.dry_run)

    print("\n2. Building core.json…")
    run_build(args.dry_run)

    print("\n3. Syncing to voice library…")
    register_in_sqlite(raw, args.dry_run)

    print(f"\n{'[dry-run] ' if args.dry_run else ''}Done. " +
          ("" if args.dry_run else "Open the voice software to generate TTS for new questions."))


if __name__ == "__main__":
    main()
