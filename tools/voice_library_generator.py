from __future__ import annotations

import json
import os
import queue
import re
import ssl
import time
import hashlib
import sqlite3
import subprocess
import threading
import shutil
import tkinter as tk
from dataclasses import dataclass
from pathlib import Path
from tkinter import filedialog, messagebox, scrolledtext, ttk
from urllib import error, request
import webbrowser


APP_TITLE = "Voice Library Generator"
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DB_PATH = PROJECT_ROOT / "content" / "voice-library" / "voice-library.sqlite"
PUBLIC_ROOT = PROJECT_ROOT / "public"
MANIFEST_PATH = PROJECT_ROOT / "content" / "games" / "cosmic-trivia" / "audio" / "tts-manifest.json"
REVIEW_STATE_PATH = PROJECT_ROOT / "content" / "voice-library" / "review-state.json"
VOICE_LIBRARY_URL = f"file://{PROJECT_ROOT / 'public' / 'voice-library' / 'index.html'}"
DIRECTOR_TS_PATH = PROJECT_ROOT / "src" / "lib" / "director" / "cosmic-trivia-director.ts"
CONFIG_PATH = Path.home() / ".voice-library-generator.json"
DEFAULT_REGENERATE_ONLY = False

REVIEW_STATUS_OPTIONS = ("unreviewed", "pending", "approved")
CA_BUNDLE_CANDIDATES = (
    os.environ.get("SSL_CERT_FILE", ""),
    os.environ.get("REQUESTS_CA_BUNDLE", ""),
    "/etc/ssl/cert.pem",
    "/opt/homebrew/etc/openssl@3/cert.pem",
    "/usr/local/etc/openssl@3/cert.pem",
)


def normalize_text(value: object) -> str:
    return str(value or "").strip().lower()


def split_voice_text(value: object) -> list[str]:
    return [part.strip() for part in str(value or "").split("//") if part.strip()]


def has_test_marker(*values: object) -> bool:
    return any("test" in normalize_text(value) for value in values if value is not None)


def truncate(text: object, limit: int = 80) -> str:
    clean = " ".join(str(text or "").split())
    if len(clean) <= limit:
        return clean
    return f"{clean[: max(0, limit - 1)]}…"


def now_ms() -> int:
    return int(time.time() * 1000)


def clean_segment(value: object) -> str:
    clean = re.sub(r"[^a-z0-9]+", "-", str(value or "").strip().lower())
    return clean.strip("-")


def normalize_event_path(value: object) -> list[str]:
    if isinstance(value, list):
        return [clean_segment(item) for item in value if clean_segment(item)]
    return [clean_segment(item) for item in str(value or "").split(".") if clean_segment(item)]


def cue_key_for(scope: str, domain: str, event_path: list[str]) -> str:
    return ".".join([scope, domain, *event_path])


def text_hash(text: str) -> str:
    return hashlib.sha256(str(text or "").encode("utf-8")).hexdigest()


def create_https_context() -> ssl.SSLContext:
    for candidate in CA_BUNDLE_CANDIDATES:
        if candidate and Path(candidate).exists():
            return ssl.create_default_context(cafile=str(candidate))
    return ssl.create_default_context()


def read_json_url(url: str) -> dict:
    with request.urlopen(url, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def post_json_url(url: str, payload: dict) -> dict:
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with request.urlopen(req, timeout=60 * 30) as response:
        return json.loads(response.read().decode("utf-8"))


def read_json_file(path: Path) -> dict:
    try:
        return json.loads(path.read_text("utf-8"))
    except Exception:
        return {}


def load_settings() -> dict[str, str]:
    try:
        if not CONFIG_PATH.exists():
            return {"apiKey": "", "voiceId": ""}
        data = json.loads(CONFIG_PATH.read_text("utf-8"))
        return {
            "apiKey": str(data.get("apiKey") or ""),
            "voiceId": str(data.get("voiceId") or ""),
        }
    except Exception:
        return {"apiKey": "", "voiceId": ""}


def save_settings(settings: dict[str, str]) -> None:
    CONFIG_PATH.write_text(json.dumps(settings, indent=2) + "\n", "utf-8")


@dataclass
class TargetRow:
    candidate_id: str
    project_title: str
    project_id: str
    group_title: str
    group_id: str
    cue_key: str
    scope: str
    domain: str
    event_path: list[str]
    candidate_label: str
    candidate_title: str
    file_name: str
    audio_path: str
    transcript: str
    status: str
    tags: list[str]
    asset_status: str
    skip_reason: str | None
    trigger_mode: str = "manual"
    trigger_phase: str = ""
    trigger_event_key: str = ""
    trigger_priority: int = 100
    trigger_enabled: bool = True

    @property
    def display_text(self) -> str:
        return self.transcript or self.candidate_label or self.candidate_title or self.file_name or ""

    @property
    def event_label(self) -> str:
        return ".".join(self.event_path)

    @property
    def event_name(self) -> str:
        return self.event_path[0] if self.event_path else ""

    @property
    def subevent_label(self) -> str:
        return ".".join(self.event_path[1:]) if len(self.event_path) > 1 else ""


def normalize_tags(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    seen: set[str] = set()
    tags: list[str] = []
    for item in value:
        tag = normalize_text(item)
        if not tag or tag in seen:
            continue
        seen.add(tag)
        tags.append(tag)
    return tags


def normalize_review_status(value: object) -> str:
    status = normalize_text(value)
    if status == "regenerate":
        return "unreviewed"
    return status if status in REVIEW_STATUS_OPTIONS else "unreviewed"


def subevent_options_for_event(rows: list["TargetRow"], selected_event: str) -> list[str]:
    scoped_rows = rows if selected_event == "All" else [row for row in rows if row.event_name == selected_event]
    return ["All", *sorted({row.subevent_label for row in scoped_rows if row.subevent_label})]


def option_values(items: list[str]) -> list[str]:
    return ["All", *sorted({item for item in items if item})]


def filter_options_for_selection(
    rows: list["TargetRow"],
    *,
    project: str = "All",
    scope: str = "All",
    domain: str = "All",
    event: str = "All",
    status: str = "All",
) -> dict[str, list[str]]:
    project_rows = rows
    scope_rows = [row for row in project_rows if project == "All" or row.project_id == project]
    domain_rows = [row for row in scope_rows if scope == "All" or row.scope == scope]
    event_rows = [row for row in domain_rows if domain == "All" or row.domain == domain]
    subevent_rows = [row for row in event_rows if event == "All" or row.event_name == event]
    return {
        "project": option_values([row.project_id for row in project_rows]),
        "scope": option_values([row.scope for row in scope_rows]),
        "domain": option_values([row.domain for row in domain_rows]),
        "event": option_values([row.event_name for row in event_rows]),
        "subevent": option_values([row.subevent_label for row in subevent_rows]),
        "status": ["All", *REVIEW_STATUS_OPTIONS],
    }


def filter_rows_for_selection(
    rows: list["TargetRow"],
    *,
    project: str = "All",
    scope: str = "All",
    domain: str = "All",
    event: str = "All",
    subevent: str = "All",
    status: str = "All",
    regenerate_only: bool = False,
) -> list["TargetRow"]:
    return [
        row
        for row in rows
        if not (regenerate_only and "regenerate" not in row.tags)
        and (project == "All" or row.project_id == project)
        and (scope == "All" or row.scope == scope)
        and (domain == "All" or row.domain == domain)
        and (event == "All" or row.event_name == event)
        and (subevent == "All" or row.subevent_label == subevent)
        and (status == "All" or normalize_review_status(row.status) == status)
    ]


def should_generate_voice_row(row: TargetRow) -> bool:
    return normalize_review_status(row.status) == "pending"


def flatten_targets(catalog: dict, review_state: dict) -> list[TargetRow]:
    candidates_state = review_state.get("candidates", {}) if isinstance(review_state, dict) else {}
    rows: list[TargetRow] = []

    for project in catalog.get("projects", []) or []:
        project_title = project.get("title") or project.get("id") or "Untitled project"
        sections = project.get("sections", {}) or {}
        for section_name in ("director", "question"):
            for group in sections.get(section_name, []) or []:
                group_title = group.get("title") or group.get("subtitle") or group.get("phase") or group.get("id") or "Untitled cue"
                group_id = group.get("id") or ""
                for candidate in group.get("candidates", []) or []:
                    candidate_id = candidate.get("id") or ""
                    state = candidates_state.get(candidate_id, {}) if isinstance(candidates_state, dict) else {}
                    tags = normalize_tags(state.get("tags"))
                    status = normalize_text(state.get("status"))
                    if "regenerate" not in tags and status != "regenerate":
                        continue

                    transcript = (
                        state.get("transcript")
                        or candidate.get("text")
                        or candidate.get("label")
                        or candidate.get("title")
                        or candidate.get("fileName")
                        or ""
                    )
                    skip_reason: str | None = None
                    if has_test_marker(
                        candidate_id,
                        candidate.get("label"),
                        candidate.get("title"),
                        candidate.get("fileName"),
                        candidate.get("text"),
                        group_id,
                        group_title,
                        candidate.get("phase"),
                        candidate.get("phaseGroup"),
                    ):
                        skip_reason = "test-sample"
                    elif not split_voice_text(transcript):
                        skip_reason = "missing-text"

                    rows.append(
                        TargetRow(
                            candidate_id=candidate_id,
                            project_title=project_title,
                            project_id=project.get("id") or "",
                            group_title=group_title,
                            group_id=group_id,
                            cue_key=candidate.get("cueKey") or group.get("cueKey") or "",
                            scope=group.get("scope") or candidate.get("scope") or "",
                            domain=group.get("domain") or candidate.get("domain") or "",
                            event_path=group.get("eventPath") or candidate.get("eventPath") or [],
                            candidate_label=candidate.get("label") or "",
                            candidate_title=candidate.get("title") or "",
                            file_name=candidate.get("fileName") or "",
                            audio_path=candidate.get("audioPath") or "",
                            transcript=str(transcript or ""),
                            status=status or "unreviewed",
                            tags=tags,
                            asset_status="unknown",
                            skip_reason=skip_reason,
                        )
                    )

    rows.sort(key=lambda row: (row.project_title.lower(), row.group_title.lower(), row.file_name.lower()))
    return rows


def flatten_db_lines(db_snapshot: dict) -> list[TargetRow]:
    rows: list[TargetRow] = []
    for line in db_snapshot.get("lines", []) or []:
        tags = normalize_tags(line.get("tags"))
        transcript = line.get("transcript") or line.get("sourceText") or ""
        skip_reason: str | None = None
        if has_test_marker(
            line.get("id"),
            line.get("groupTitle"),
            line.get("fileName"),
            line.get("sourceText"),
            line.get("cueKey"),
        ):
            skip_reason = "test-sample"
        elif "regenerate" in tags and not split_voice_text(transcript):
            skip_reason = "missing-text"

        rows.append(
            TargetRow(
                candidate_id=line.get("id") or line.get("candidateId") or "",
                project_title=line.get("projectTitle") or line.get("projectId") or "Untitled project",
                project_id=line.get("projectId") or "",
                group_title=line.get("groupTitle") or line.get("cueKey") or "Untitled cue",
                group_id=line.get("groupId") or "",
                cue_key=line.get("cueKey") or "",
                scope=line.get("scope") or "",
                domain=line.get("domain") or "",
                event_path=line.get("eventPath") or [],
                candidate_label=line.get("sourceText") or "",
                candidate_title=line.get("fileName") or "",
                file_name=line.get("fileName") or "",
                audio_path=line.get("audioPath") or "",
                transcript=str(transcript or ""),
                status=line.get("status") or "unreviewed",
                tags=tags,
                asset_status=line.get("assetStatus") or "unknown",
                skip_reason=skip_reason,
                trigger_mode=line.get("triggerMode") or "manual",
                trigger_phase=line.get("triggerPhase") or "",
                trigger_event_key=line.get("triggerEventKey") or "",
                trigger_priority=int(line.get("triggerPriority") or 100),
                trigger_enabled=bool(line.get("triggerEnabled", True)),
            )
        )
    rows.sort(key=lambda row: (row.project_title.lower(), row.scope, row.domain, row.event_label, row.file_name.lower()))
    return rows


def parse_json_cell(value: object, fallback: object) -> object:
    try:
        return json.loads(str(value or ""))
    except Exception:
        return fallback


def db_connection() -> sqlite3.Connection:
    if not DB_PATH.exists():
        raise FileNotFoundError(f"SQLite database not found: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    ensure_db_schema(conn)
    return conn


def ensure_db_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS director_trigger_rules (
          cue_key TEXT PRIMARY KEY REFERENCES voice_cues(cue_key) ON DELETE CASCADE,
          trigger_mode TEXT NOT NULL DEFAULT 'manual',
          phase TEXT,
          event_key TEXT,
          priority INTEGER NOT NULL DEFAULT 100,
          enabled INTEGER NOT NULL DEFAULT 1,
          updated_at INTEGER NOT NULL
        )
        """
    )
    conn.commit()


def audio_path_to_file_path(audio_path: str) -> Path:
    return PUBLIC_ROOT / str(audio_path or "").lstrip("/")


def asset_status_for(audio_path: str) -> tuple[str, int | None]:
    file_path = audio_path_to_file_path(audio_path)
    if not file_path.exists():
        return "missing-file", None
    return "ready", file_path.stat().st_size


def load_local_lines() -> list[TargetRow]:
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT
              l.line_id,
              l.cue_key,
              l.game_id,
              l.file_name,
              l.audio_path,
              l.source_text,
              l.tone,
              l.audience,
              l.visibility,
              c.project_title,
              c.group_id,
              c.title AS group_title,
              c.scope,
              c.domain,
              c.event_path_json,
              r.status,
              r.tags_json,
              r.transcript,
              a.asset_status,
              a.file_size,
              t.trigger_mode,
              t.phase AS trigger_phase,
              t.event_key AS trigger_event_key,
              t.priority AS trigger_priority,
              t.enabled AS trigger_enabled
            FROM voice_lines l
            JOIN voice_cues c ON c.cue_key = l.cue_key
            JOIN voice_review_state r ON r.line_id = l.line_id
            LEFT JOIN voice_assets a ON a.line_id = l.line_id
            LEFT JOIN director_trigger_rules t ON t.cue_key = c.cue_key
            ORDER BY c.project_title, c.scope, c.domain, c.event_path_json, l.file_name
            """
        ).fetchall()

    snapshot = {"lines": []}
    for row in rows:
        status, file_size = asset_status_for(row["audio_path"])
        snapshot["lines"].append(
            {
                "id": row["line_id"],
                "candidateId": row["line_id"],
                "cueKey": row["cue_key"],
                "projectId": row["game_id"],
                "projectTitle": row["project_title"],
                "groupId": row["group_id"],
                "groupTitle": row["group_title"],
                "scope": row["scope"],
                "domain": row["domain"],
                "eventPath": parse_json_cell(row["event_path_json"], []),
                "fileName": row["file_name"],
                "audioPath": row["audio_path"],
                "sourceText": row["source_text"],
                "transcript": row["transcript"],
                "status": row["status"],
                "tags": parse_json_cell(row["tags_json"], []),
                "tone": row["tone"] or "",
                "audience": row["audience"] or "",
                "visibility": row["visibility"] or "",
                "assetStatus": status,
                "fileSize": file_size,
                "triggerMode": row["trigger_mode"] or "manual",
                "triggerPhase": row["trigger_phase"] or "",
                "triggerEventKey": row["trigger_event_key"] or "",
                "triggerPriority": row["trigger_priority"] if row["trigger_priority"] is not None else 100,
                "triggerEnabled": row["trigger_enabled"] != 0,
            }
        )
    return flatten_db_lines(snapshot)


def next_line_number(conn: sqlite3.Connection, cue_key: str) -> int:
    rows = conn.execute("SELECT file_name FROM voice_lines WHERE cue_key = ?", (cue_key,)).fetchall()
    used: list[int] = []
    for row in rows:
        match = re.match(r"line-(\d+)\.mp3$", str(row["file_name"] or ""), flags=re.IGNORECASE)
        if match:
            used.append(int(match.group(1)))
    return max(used, default=0) + 1


def create_local_cue(
    *,
    scope: str,
    domain: str,
    event: str,
    subevent: str,
    title: str,
    transcript: str,
    trigger_mode: str,
    trigger_phase: str,
    trigger_event_key: str,
    priority: int,
) -> dict:
    clean_scope = clean_segment(scope)
    clean_domain = clean_segment(domain)
    event_path = normalize_event_path([event, *str(subevent or "").split(".")])
    if clean_scope not in {"phase", "global", "cross"}:
        raise ValueError("Scope must be phase, global, or cross.")
    if not clean_domain:
        raise ValueError("Phase / Domain is required.")
    if not event_path:
        raise ValueError("Event is required.")
    cue_key = cue_key_for(clean_scope, clean_domain, event_path)
    timestamp = now_ms()
    with db_connection() as conn:
        conn.execute(
            """
            INSERT INTO voice_cues (
              cue_key, game_id, project_title, group_id, title, scope, domain, event_path_json, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(cue_key) DO UPDATE SET
              scope = excluded.scope,
              domain = excluded.domain,
              event_path_json = excluded.event_path_json,
              updated_at = excluded.updated_at
            """,
            (
                cue_key,
                "cosmic-trivia",
                "Cosmic Trivia",
                f"cosmic-trivia:director:{cue_key}",
                title.strip() or cue_key,
                clean_scope,
                clean_domain,
                json.dumps(event_path),
                timestamp,
            ),
        )
        conn.execute(
            """
            INSERT INTO director_trigger_rules (
              cue_key, trigger_mode, phase, event_key, priority, enabled, updated_at
            ) VALUES (?, ?, ?, ?, ?, 1, ?)
            ON CONFLICT(cue_key) DO UPDATE SET
              trigger_mode = excluded.trigger_mode,
              phase = excluded.phase,
              event_key = excluded.event_key,
              priority = excluded.priority,
              enabled = excluded.enabled,
              updated_at = excluded.updated_at
            """,
            (
                cue_key,
                trigger_mode if trigger_mode in {"manual", "phase-entry", "event-match", "fallback-only"} else "manual",
                trigger_phase.strip() or (clean_domain if clean_scope == "phase" else ""),
                trigger_event_key.strip(),
                int(priority or 100),
                timestamp,
            ),
        )
        conn.commit()
    line = create_local_line(cue_key, transcript)
    return {"cueKey": cue_key, **line}


def create_local_line(cue_key: str, transcript: str) -> dict:
    timestamp = now_ms()
    with db_connection() as conn:
        cue = conn.execute("SELECT * FROM voice_cues WHERE cue_key = ?", (cue_key,)).fetchone()
        if not cue:
            raise ValueError(f"Unknown cue: {cue_key}")
        event_path = parse_json_cell(cue["event_path_json"], [])
        line_number = next_line_number(conn, cue_key)
        file_name = f"line-{line_number:02d}.mp3"
        line_id = f"{cue_key}.line-{line_number:02d}"
        audio_path = f"/games/{cue['game_id']}/audio/host/director/{cue['scope']}/{cue['domain']}/{'/'.join(event_path)}/{file_name}"
        conn.execute(
            """
            INSERT INTO voice_lines (
              line_id, cue_key, game_id, kind, file_name, audio_path, source_text, source_text_hash,
              tone, audience, visibility, active, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            """,
            (
                line_id,
                cue_key,
                cue["game_id"],
                "director-candidate",
                file_name,
                audio_path,
                transcript,
                text_hash(transcript),
                "witty",
                "host",
                "public-safe",
                timestamp,
            ),
        )
        conn.execute(
            """
            INSERT INTO voice_review_state (line_id, status, tags_json, transcript, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (line_id, "unreviewed", json.dumps(["regenerate"]), transcript, timestamp),
        )
        update_asset_record(conn, line_id, audio_path, transcript, "missing-file")
        conn.commit()
    mirror_review_state_candidate(line_id, transcript=transcript, tags=["regenerate"], status="unreviewed")
    build_runtime_manifest()
    return {"lineId": line_id, "fileName": file_name, "audioPath": audio_path}


def delete_local_line(line_id: str) -> dict:
    """Delete a voice line and its audio file from the library."""
    with db_connection() as conn:
        row = conn.execute(
            "SELECT audio_path FROM voice_lines WHERE line_id = ?", (line_id,)
        ).fetchone()
        if not row:
            raise ValueError(f"Unknown voice line: {line_id}")
        audio_path = row["audio_path"] or ""
        conn.execute("DELETE FROM voice_lines WHERE line_id = ?", (line_id,))
        conn.execute("DELETE FROM voice_review_state WHERE line_id = ?", (line_id,))
        conn.execute("DELETE FROM voice_assets WHERE line_id = ?", (line_id,))
        conn.commit()
    if audio_path:
        file_path = audio_path_to_file_path(audio_path)
        if file_path.exists():
            file_path.unlink()
    build_runtime_manifest()
    return {"lineId": line_id, "deleted": True}


def rename_cue(old_key: str, new_scope: str, new_domain: str, new_event: str, new_subevent: str) -> dict:
    """Rename a cue by changing its structural fields (scope/domain/event/subevent).
    Updates all related DB records and renames audio files on disk."""
    new_event_path = normalize_event_path([new_event, *str(new_subevent or "").split(".")])
    new_key = cue_key_for(new_scope, new_domain, new_event_path)

    if new_key == old_key:
        return {"oldKey": old_key, "newKey": new_key, "changed": False}

    with db_connection() as conn:
        if conn.execute("SELECT 1 FROM voice_cues WHERE cue_key = ?", (new_key,)).fetchone():
            raise ValueError(f"Cue '{new_key}' already exists — choose a different name.")
        old_cue = conn.execute("SELECT * FROM voice_cues WHERE cue_key = ?", (old_key,)).fetchone()
        if not old_cue:
            raise ValueError(f"Cue '{old_key}' not found.")
        old_lines = conn.execute("SELECT * FROM voice_lines WHERE cue_key = ?", (old_key,)).fetchall()
        timestamp = now_ms()

        conn.execute(
            """INSERT INTO voice_cues
               (cue_key, game_id, project_title, group_id, title, scope, domain, event_path_json, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (new_key, old_cue["game_id"], old_cue["project_title"],
             f"{old_cue['game_id']}:director:{new_key}",
             old_cue["title"], new_scope, new_domain, json.dumps(new_event_path), timestamp),
        )
        conn.execute("UPDATE director_trigger_rules SET cue_key = ? WHERE cue_key = ?", (new_key, old_key))

        file_renames: list[tuple[str, str]] = []
        for line in old_lines:
            old_lid = line["line_id"]
            suffix = old_lid[len(old_key) + 1:]  # e.g. "line-01"
            new_lid = f"{new_key}.{suffix}"
            new_audio = (
                f"/games/{old_cue['game_id']}/audio/host/director"
                f"/{new_scope}/{new_domain}/{'/'.join(new_event_path)}/{line['file_name']}"
            )
            conn.execute(
                """INSERT INTO voice_lines
                   (line_id, cue_key, game_id, kind, file_name, audio_path, source_text,
                    source_text_hash, tone, audience, visibility, active, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (new_lid, new_key, line["game_id"], line["kind"], line["file_name"], new_audio,
                 line["source_text"], line["source_text_hash"], line["tone"], line["audience"],
                 line["visibility"], line["active"], timestamp),
            )
            for table, col in (("voice_review_state", "line_id"), ("voice_assets", "line_id")):
                old_row = conn.execute(f"SELECT * FROM {table} WHERE {col} = ?", (old_lid,)).fetchone()
                if old_row:
                    cols = [k for k in old_row.keys() if k != col]
                    placeholders = ", ".join("?" * (len(cols) + 1))
                    col_names = ", ".join([col] + cols)
                    values = [new_lid] + [
                        new_audio if (table == "voice_assets" and c == "audio_path") else old_row[c]
                        for c in cols
                    ]
                    conn.execute(f"INSERT OR REPLACE INTO {table} ({col_names}) VALUES ({placeholders})", values)
                conn.execute(f"DELETE FROM {table} WHERE {col} = ?", (old_lid,))
            conn.execute("DELETE FROM voice_lines WHERE line_id = ?", (old_lid,))
            file_renames.append((line["audio_path"], new_audio))

        conn.execute("DELETE FROM voice_cues WHERE cue_key = ?", (old_key,))
        conn.commit()

    for old_path, new_path in file_renames:
        old_file = audio_path_to_file_path(old_path)
        new_file = audio_path_to_file_path(new_path)
        if old_file.exists():
            new_file.parent.mkdir(parents=True, exist_ok=True)
            old_file.rename(new_file)

    build_runtime_manifest()
    return {"oldKey": old_key, "newKey": new_key, "changed": True}


def save_local_transcript(line_id: str, transcript: str) -> dict:
    with db_connection() as conn:
        existing = conn.execute("SELECT line_id FROM voice_lines WHERE line_id = ?", (line_id,)).fetchone()
        if not existing:
            raise ValueError(f"Unknown voice line: {line_id}")
        current = conn.execute("SELECT tags_json, status FROM voice_review_state WHERE line_id = ?", (line_id,)).fetchone()
        tags = normalize_tags(parse_json_cell(current["tags_json"], []) if current else [])
        if "regenerate" not in tags:
            tags.append("regenerate")
        status = "unreviewed" if not current or current["status"] == "approved" else current["status"]
        conn.execute(
            """
            INSERT INTO voice_review_state (line_id, status, tags_json, transcript, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(line_id) DO UPDATE SET
              status = excluded.status,
              tags_json = excluded.tags_json,
              transcript = excluded.transcript,
              updated_at = excluded.updated_at
            """,
            (line_id, status or "unreviewed", json.dumps(tags), transcript, int(__import__("time").time() * 1000)),
        )
        conn.commit()
    mirror_review_state_candidate(line_id, transcript=transcript, tags=tags, status=status or "unreviewed")
    return {"lineId": line_id, "transcript": transcript, "tags": tags, "status": status or "unreviewed"}


def save_local_review(line_id: str, *, status: str) -> dict:
    clean_status = normalize_review_status(status)
    with db_connection() as conn:
        existing = conn.execute(
            """
            SELECT r.transcript, r.tags_json
            FROM voice_lines l
            JOIN voice_review_state r ON r.line_id = l.line_id
            WHERE l.line_id = ?
            """,
            (line_id,),
        ).fetchone()
        if not existing:
            raise ValueError(f"Unknown voice line: {line_id}")
        conn.execute(
            """
            UPDATE voice_review_state
            SET status = ?, updated_at = ?
            WHERE line_id = ?
            """,
            (clean_status, now_ms(), line_id),
        )
        conn.commit()
    tags = normalize_tags(parse_json_cell(existing["tags_json"], []))
    mirror_review_state_candidate(line_id, transcript=existing["transcript"], tags=tags, status=clean_status)
    return {"lineId": line_id, "status": clean_status}


def mirror_review_state_candidate(line_id: str, transcript: str, tags: list[str], status: str) -> None:
    state = read_json_file(REVIEW_STATE_PATH)
    if not state:
        state = {"groups": {}, "candidates": {}, "customTags": []}
    state.setdefault("groups", {})
    state.setdefault("candidates", {})
    state.setdefault("customTags", [])
    candidate = state["candidates"].setdefault(line_id, {"id": line_id, "notes": []})
    candidate["status"] = status
    candidate["tags"] = tags
    candidate["transcript"] = transcript
    candidate["transcriptSegments"] = split_voice_text(transcript)
    candidate["updatedAt"] = int(__import__("time").time() * 1000)
    if "regenerate" in tags and "regenerate" not in state["customTags"]:
        state["customTags"].append("regenerate")
        state["customTags"] = sorted(set(state["customTags"]))
    REVIEW_STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", "utf-8")


def update_asset_record(conn: sqlite3.Connection, line_id: str, audio_path: str, text: str, status: str) -> None:
    file_path = audio_path_to_file_path(audio_path)
    file_size = file_path.stat().st_size if file_path.exists() else None
    conn.execute(
        """
        INSERT INTO voice_assets (line_id, audio_path, file_hash, file_size, text_hash, asset_status, checked_at)
        VALUES (?, ?, NULL, ?, NULL, ?, ?)
        ON CONFLICT(line_id) DO UPDATE SET
          audio_path = excluded.audio_path,
          file_size = excluded.file_size,
          asset_status = excluded.asset_status,
          checked_at = excluded.checked_at
        """,
        (line_id, audio_path, file_size, status, int(__import__("time").time() * 1000)),
    )


def generate_speech(api_key: str, base_url: str, voice_id: str, model_id: str, output_format: str, text: str, voice_settings: dict, output_path: Path) -> None:
    payload = {
        "text": text,
        "model_id": model_id,
    }
    if voice_settings:
        payload["voice_settings"] = voice_settings
    body = json.dumps(payload).encode("utf-8")
    req = request.Request(
        f"{base_url}/v1/text-to-speech/{voice_id}?output_format={output_format}",
        data=body,
        method="POST",
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
        },
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with request.urlopen(req, timeout=60 * 10, context=create_https_context()) as response, output_path.open("wb") as output_file:
        shutil.copyfileobj(response, output_file, length=1024 * 64)


def ensure_director_triggered_column() -> None:
    if not DB_PATH.exists():
        return
    conn = sqlite3.connect(str(DB_PATH))
    try:
        conn.execute("ALTER TABLE voice_cues ADD COLUMN director_triggered INTEGER DEFAULT 0")
        conn.commit()
    except sqlite3.OperationalError:
        pass  # column already exists
    finally:
        conn.close()


CUE_LIBRARY_TS_PATH = PROJECT_ROOT / "src" / "lib" / "director" / "cosmic-trivia-cue-library.ts"

# Cue keys triggered through indirect mechanisms not visible as simple string literals.
# global.game.default: referenced in cue-library fallbackOrder, not in director rules.
INDIRECT_TRIGGER_KEYS: set[str] = {"global.game.default"}
INDIRECT_TRIGGER_PREFIXES: tuple[str, ...] = ()


def audit_director_triggers() -> dict[str, bool]:
    """
    Parse the director TS file (and cue-library TS) to find all cue keys
    that are reachable, then update director_triggered in voice_cues.
    Returns {cue_key: triggered}.

    Detection strategies:
      1. Any double-quoted string matching a cue key pattern — catches both
         direct cueAudio("key") calls AND ternary branches.
      2. Template literal base prefixes like `phase.x.${var}` — finds all
         DB cues whose key starts with that prefix.
      3. eventKey: "key" references.
      4. phaseEntryAudio("phase") — resolves via director_trigger_rules.
      5. Indirect / hardcoded keys (fallback cue, question audio).
    """
    ensure_director_triggered_column()
    if not DB_PATH.exists() or not DIRECTOR_TS_PATH.exists():
        return {}

    # Scan both director and cue-library files.
    sources: list[str] = [DIRECTOR_TS_PATH.read_text(encoding="utf-8")]
    if CUE_LIBRARY_TS_PATH.exists():
        sources.append(CUE_LIBRARY_TS_PATH.read_text(encoding="utf-8"))
    combined = "\n".join(sources)

    # 1. Any double-quoted cue key literal (covers ternary branches too).
    cue_key_pattern = r'"((phase|global|cross|question)\.[a-z0-9][a-z0-9.\-]+)"'
    triggered: set[str] = set(re.findall(cue_key_pattern, combined, re.IGNORECASE))
    # re.findall with groups returns tuples; take the full match group (index 0).
    triggered = {m[0] if isinstance(m, tuple) else m for m in triggered}

    # 2. Template literal prefixes like `phase.final-hype.summary.${kind}`.
    template_prefixes = re.findall(
        r'`((phase|global|cross)\.[a-z0-9.\-]+)\$\{', combined, re.IGNORECASE
    )
    template_prefix_strs = [m[0] if isinstance(m, tuple) else m for m in template_prefixes]

    # 3. eventKey: "key" references (already covered by #1, kept for clarity).
    triggered.update(re.findall(r'eventKey:\s*"([^"]+)"', combined))

    # 4. phaseEntryAudio("phase") → resolve via director_trigger_rules.
    phases = set(re.findall(r'phaseEntryAudio\("([^"]+)"', combined))
    conn = sqlite3.connect(str(DB_PATH))
    if phases:
        placeholders = ",".join("?" * len(phases))
        rows = conn.execute(
            f"SELECT c.cue_key FROM voice_cues c "
            f"JOIN director_trigger_rules t ON t.cue_key = c.cue_key "
            f"WHERE c.game_id = 'cosmic-trivia' AND t.phase IN ({placeholders}) "
            f"AND t.trigger_mode != 'manual'",
            list(phases),
        ).fetchall()
        triggered.update(row[0] for row in rows)

    all_keys = {row[0] for row in conn.execute(
        "SELECT cue_key FROM voice_cues WHERE game_id = 'cosmic-trivia'"
    ).fetchall()}

    # Resolve template prefixes against actual DB keys.
    for prefix in template_prefix_strs:
        for key in all_keys:
            if key.startswith(prefix):
                triggered.add(key)

    # 5. Indirect keys (e.g. global.game.default via cue-library fallbackOrder).
    triggered.update(INDIRECT_TRIGGER_KEYS & all_keys)

    result: dict[str, bool] = {}
    for cue_key in all_keys:
        is_triggered = cue_key in triggered
        result[cue_key] = is_triggered
        conn.execute(
            "UPDATE voice_cues SET director_triggered = ? WHERE cue_key = ?",
            (1 if is_triggered else 0, cue_key),
        )
    conn.commit()
    conn.close()
    return result


def build_runtime_manifest() -> str:
    result = subprocess.run(
        ["node", "scripts/build-cosmic-trivia-director-cues.js"],
        cwd=PROJECT_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr or result.stdout or "Runtime manifest build failed")
    return result.stdout.strip()


def generate_local_marked(api_key: str, voice_id_override: str = "", line_ids: list[str] | None = None) -> dict:
    manifest = read_json_file(MANIFEST_PATH)
    base_url = str(__import__("os").environ.get("ELEVENLABS_BASE_URL") or "https://api.elevenlabs.io").rstrip("/")
    model_id = str(__import__("os").environ.get("ELEVENLABS_MODEL_ID") or manifest.get("modelId") or "eleven_v3")
    output_format = str(__import__("os").environ.get("ELEVENLABS_OUTPUT_FORMAT") or manifest.get("outputFormat") or "mp3_44100_128")
    voice_settings = manifest.get("voiceSettings") or {}
    default_voice_id = voice_id_override or str(manifest.get("voiceId") or "")
    if not api_key:
        raise ValueError("Missing API key. Add it in the API Key field.")
    if not default_voice_id:
        raise ValueError("Missing Voice ID. Add a Voice ID override or set one in the manifest.")

    generated: list[dict] = []
    skipped: list[dict] = []
    with db_connection() as conn:
        if line_ids:
            unique_ids = list(dict.fromkeys(line_ids))
            placeholders = ",".join("?" for _ in unique_ids)
            rows = conn.execute(
                f"""
                SELECT l.line_id, l.audio_path, l.file_name, r.transcript, r.tags_json, a.asset_status
                FROM voice_lines l
                JOIN voice_review_state r ON r.line_id = l.line_id
                LEFT JOIN voice_assets a ON a.line_id = l.line_id
                WHERE l.line_id IN ({placeholders})
                ORDER BY l.line_id
                """,
                unique_ids,
            ).fetchall()
            row_map = {row["line_id"]: row for row in rows}
            rows = [row_map[line_id] for line_id in unique_ids if line_id in row_map]
        else:
            rows = conn.execute(
                """
                SELECT l.line_id, l.audio_path, l.file_name, r.transcript, r.tags_json, a.asset_status
                FROM voice_lines l
                JOIN voice_review_state r ON r.line_id = l.line_id
                LEFT JOIN voice_assets a ON a.line_id = l.line_id
                WHERE r.status = 'pending'
                ORDER BY l.line_id
                """
            ).fetchall()
        for row in rows:
            line_id = row["line_id"]
            text = row["transcript"].strip()
            if not split_voice_text(text):
                skipped.append({"id": line_id, "reason": "missing-text"})
                continue
            if has_test_marker(line_id, row["file_name"], text):
                skipped.append({"id": line_id, "reason": "test-sample"})
                continue
            output_path = audio_path_to_file_path(row["audio_path"])
            output_path.parent.mkdir(parents=True, exist_ok=True)
            generate_speech(
                api_key=api_key,
                base_url=base_url,
                voice_id=default_voice_id,
                model_id=model_id,
                output_format=output_format,
                text=text,
                voice_settings=voice_settings,
                output_path=output_path,
            )
            tags = [tag for tag in normalize_tags(parse_json_cell(row["tags_json"], [])) if tag != "regenerate"]
            conn.execute(
                """
                UPDATE voice_review_state
                SET status = ?, tags_json = ?, updated_at = ?
                WHERE line_id = ?
                """,
                ("pending", json.dumps(tags), int(__import__("time").time() * 1000), line_id),
            )
            update_asset_record(conn, line_id, row["audio_path"], text, "ready")
            mirror_review_state_candidate(line_id, transcript=text, tags=tags, status="pending")
            generated.append({"id": line_id, "outputPath": str(output_path)})
        conn.commit()
    manifest_log = build_runtime_manifest() if generated else ""
    return {"generated": generated, "skipped": skipped, "manifestLog": manifest_log}


# ── Questions helpers ──────────────────────────────────────────────────────────

def load_questions_from_db() -> list[dict]:
    """Load all questions from the SQLite questions table."""
    if not DB_PATH.exists():
        return []
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT id, category, difficulty, question, question_audio, enabled FROM questions "
        "WHERE game_id = 'cosmic-trivia' ORDER BY id"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def question_audio_exists(audio_path: str) -> bool:
    if not audio_path:
        return False
    return (PUBLIC_ROOT / str(audio_path).lstrip("/")).exists()


def insert_questions_from_json(questions: list[dict], dry_run: bool = False) -> tuple[int, int]:
    """Insert questions into SQLite. Returns (inserted, skipped)."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    inserted = 0
    skipped = 0
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        for q in questions:
            if dry_run:
                skipped += 1
                continue
            conn.execute(
                """INSERT OR IGNORE INTO questions
                   (id, game_id, category, tags_json, difficulty, question,
                    answer_a, answer_b, answer_c, answer_d, correct_answer,
                    fact, question_audio, answer_audio, enabled, created_at, updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    q["id"], "cosmic-trivia", q["category"],
                    json.dumps(q.get("tags", [])), q["difficulty"], q["question"],
                    q.get("answerA", ""), q.get("answerB", ""),
                    q.get("answerC", ""), q.get("answerD", ""),
                    str(q.get("correctAnswer", "")).lower(), q.get("fact", ""),
                    q.get("questionAudio", ""), q.get("answerAudio", ""), 1, now, now,
                ),
            )
            if conn.execute("SELECT changes()").fetchone()[0]:
                inserted += 1
            else:
                skipped += 1
        conn.commit()
    return inserted, skipped


def register_question_voice_cues(questions: list[dict]) -> tuple[int, int]:
    """Register voice cues for questions. Returns (added, skipped)."""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    added = 0
    skipped = 0
    with sqlite3.connect(str(DB_PATH)) as conn:
        conn.row_factory = sqlite3.Row
        for q in questions:
            qid = q["id"]
            cue_key = f"question.{qid}.read"
            line_id = f"{qid}-line-01"
            exists = conn.execute(
                "SELECT 1 FROM voice_cues WHERE cue_key = ?", (cue_key,)
            ).fetchone()
            if exists:
                skipped += 1
                continue
            audio_path = q.get("questionAudio", "")
            source_text = q["question"]
            file_name = Path(audio_path).name if audio_path else ""
            conn.execute(
                """INSERT INTO voice_cues
                   (cue_key, game_id, project_title, group_id, title, scope, domain,
                    event_path_json, updated_at, director_triggered)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (cue_key, "cosmic-trivia", "题目朗读", f"questions.{q['category']}",
                 source_text[:60], "question", "read", json.dumps([qid]), now, 0),
            )
            conn.execute(
                """INSERT INTO voice_lines
                   (line_id, cue_key, game_id, kind, file_name, audio_path, source_text,
                    source_text_hash, tone, audience, visibility, active, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (line_id, cue_key, "cosmic-trivia", "line", file_name, audio_path,
                 source_text, text_hash(source_text), "neutral", "all", "public", 1, now),
            )
            conn.execute(
                """INSERT INTO voice_review_state (line_id, status, tags_json, transcript, updated_at)
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
        conn.commit()
    return added, skipped


def auto_assign_ids_and_audio(questions: list[dict], existing_ids: set[str]) -> None:
    """Assign missing IDs and questionAudio fields in-place."""
    import re as _re
    for q in questions:
        if not q.get("id"):
            category = q.get("category", "general")
            pattern = _re.compile(rf"^core-{_re.escape(category)}-(\d+)$")
            max_num = max(
                (int(m.group(1)) for qid in existing_ids if (m := pattern.match(qid))),
                default=0,
            )
            q["id"] = f"core-{category}-{max_num + 1:03d}"
        existing_ids.add(q["id"])
        if not q.get("questionAudio"):
            q["questionAudio"] = f"/games/cosmic-trivia/audio/{q['id']}-question.mp3"


class VoiceLibraryGeneratorApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title(APP_TITLE)
        self.geometry("1320x820")
        self.minsize(1080, 720)

        self.task_queue: queue.Queue[tuple[str, object]] = queue.Queue()
        self.busy = False
        self.preview_process: subprocess.Popen | None = None
        self.catalog: dict = {}
        self.review_state: dict = {}
        self.all_targets: list[TargetRow] = []
        self.targets: list[TargetRow] = []
        self.row_map: dict[str, TargetRow] = {}
        self._selection_anchor_id: str | None = None
        self.settings = load_settings()
        self.api_key_var = tk.StringVar(value=self.settings.get("apiKey", ""))
        self.voice_id_var = tk.StringVar(value=self.settings.get("voiceId", ""))
        self.review_status_var = tk.StringVar(value="unreviewed")
        self.project_filter_var = tk.StringVar(value="All")
        self.scope_filter_var = tk.StringVar(value="All")
        self.domain_filter_var = tk.StringVar(value="All")
        self.event_filter_var = tk.StringVar(value="All")
        self.subevent_filter_var = tk.StringVar(value="All")
        self.status_filter_var = tk.StringVar(value="All")
        self.regenerate_only_var = tk.BooleanVar(value=DEFAULT_REGENERATE_ONLY)

        self._build_styles()
        self._build_ui()
        self.after(100, self.refresh_data)
        self.after(200, self._poll_queue)
        self.after(300, ensure_director_triggered_column)

    def _build_styles(self) -> None:
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except Exception:
            pass
        style.configure("Header.TLabel", font=("Helvetica", 20, "bold"))
        style.configure("Subtle.TLabel", foreground="#666666")
        style.configure("Accent.TButton", font=("Helvetica", 11, "bold"))
        style.configure("Status.TButton", padding=(8, 4))
        style.configure("StatusActive.TButton", padding=(8, 4), font=("Helvetica", 10, "bold"))
        style.configure("Treeview", rowheight=30)
        style.configure("Treeview.Heading", font=("Helvetica", 10, "bold"))

    def _build_ui(self) -> None:
        self.columnconfigure(0, weight=1)
        self.rowconfigure(3, weight=1)

        top = ttk.Frame(self, padding=(16, 14, 16, 8))
        top.grid(row=0, column=0, sticky="ew")
        top.columnconfigure(0, weight=1)

        title_row = ttk.Frame(top)
        title_row.grid(row=0, column=0, sticky="ew")
        title_row.columnconfigure(0, weight=1)

        ttk.Label(title_row, text="Voice Library Generator", style="Header.TLabel").grid(row=0, column=0, sticky="w")
        self.summary_var = tk.StringVar(value="Loading…")
        ttk.Label(title_row, textvariable=self.summary_var, style="Subtle.TLabel").grid(row=1, column=0, sticky="w", pady=(4, 0))

        button_row = ttk.Frame(top)
        button_row.grid(row=0, column=1, rowspan=2, sticky="e")
        self.refresh_button = ttk.Button(button_row, text="Refresh", command=self.refresh_data)
        self.refresh_button.grid(row=0, column=0, padx=(0, 8))
        self.generate_button = ttk.Button(button_row, text="Generate pending voices", style="Accent.TButton", command=self.generate_marked)
        self.generate_button.grid(row=0, column=1, padx=(0, 8))
        self.rebuild_cue_button = ttk.Button(button_row, text="Rebuild cue library", command=self.rebuild_cue_library)
        self.rebuild_cue_button.grid(row=0, column=2, padx=(0, 8))
        self.audit_button = ttk.Button(button_row, text="检查触发状态", command=self.audit_triggers)
        self.audit_button.grid(row=0, column=3, padx=(0, 8))
        self.generate_selected_button = ttk.Button(button_row, text="Regenerate selected", command=self.generate_selected)
        self.generate_selected_button.grid(row=0, column=4, padx=(0, 8))
        ttk.Button(button_row, text="Open Voice Library", command=lambda: webbrowser.open(VOICE_LIBRARY_URL)).grid(row=0, column=5)

        settings_row = ttk.Frame(top)
        settings_row.grid(row=1, column=0, columnspan=2, sticky="ew", pady=(14, 0))
        settings_row.columnconfigure(1, weight=1)
        settings_row.columnconfigure(3, weight=1)
        ttk.Label(settings_row, text="API Key").grid(row=0, column=0, sticky="w", padx=(0, 8))
        api_entry = ttk.Entry(settings_row, textvariable=self.api_key_var, show="•")
        api_entry.grid(row=0, column=1, sticky="ew", padx=(0, 16))
        ttk.Label(settings_row, text="Voice ID override").grid(row=0, column=2, sticky="w", padx=(0, 8))
        voice_entry = ttk.Entry(settings_row, textvariable=self.voice_id_var)
        voice_entry.grid(row=0, column=3, sticky="ew", padx=(0, 16))
        ttk.Button(settings_row, text="Save settings", command=self.save_settings).grid(row=0, column=4, sticky="e")
        api_entry.bind("<FocusOut>", lambda _event: self.save_settings())
        voice_entry.bind("<FocusOut>", lambda _event: self.save_settings())

        filter_row = ttk.Frame(top)
        filter_row.grid(row=2, column=0, columnspan=2, sticky="ew", pady=(12, 0))
        for index in (1, 3, 5, 7):
            filter_row.columnconfigure(index, weight=1)

        ttk.Label(filter_row, text="Project").grid(row=0, column=0, sticky="w", padx=(0, 6))
        self.project_filter = ttk.Combobox(filter_row, textvariable=self.project_filter_var, state="readonly", values=["All"])
        self.project_filter.grid(row=0, column=1, sticky="ew", padx=(0, 12))

        ttk.Label(filter_row, text="Scope").grid(row=0, column=2, sticky="w", padx=(0, 6))
        self.scope_filter = ttk.Combobox(filter_row, textvariable=self.scope_filter_var, state="readonly", values=["All"])
        self.scope_filter.grid(row=0, column=3, sticky="ew", padx=(0, 12))

        ttk.Label(filter_row, text="Phase / Domain").grid(row=0, column=4, sticky="w", padx=(0, 6))
        self.domain_filter = ttk.Combobox(filter_row, textvariable=self.domain_filter_var, state="readonly", values=["All"])
        self.domain_filter.grid(row=0, column=5, sticky="ew", padx=(0, 12))

        ttk.Label(filter_row, text="Event").grid(row=0, column=6, sticky="w", padx=(0, 6))
        self.event_filter = ttk.Combobox(filter_row, textvariable=self.event_filter_var, state="readonly", values=["All"])
        self.event_filter.grid(row=0, column=7, sticky="ew", padx=(0, 12))

        ttk.Label(filter_row, text="Subevent").grid(row=1, column=0, sticky="w", padx=(0, 6), pady=(8, 0))
        self.subevent_filter = ttk.Combobox(filter_row, textvariable=self.subevent_filter_var, state="readonly", values=["All"])
        self.subevent_filter.grid(row=1, column=1, sticky="ew", padx=(0, 12), pady=(8, 0))

        ttk.Label(filter_row, text="Status").grid(row=1, column=2, sticky="w", padx=(0, 6), pady=(8, 0))
        status_filter_buttons = ttk.Frame(filter_row)
        status_filter_buttons.grid(row=1, column=3, sticky="ew", padx=(0, 12), pady=(8, 0))
        self.status_filter_buttons: dict[str, ttk.Button] = {}
        for index, status in enumerate(("All", *REVIEW_STATUS_OPTIONS)):
            button = ttk.Button(
                status_filter_buttons,
                text=status,
                style="Status.TButton",
                command=lambda value=status: self.set_status_filter(value),
            )
            button.grid(row=0, column=index, sticky="ew", padx=(0, 4))
            self.status_filter_buttons[status] = button

        ttk.Checkbutton(filter_row, text="Regenerate only", variable=self.regenerate_only_var, command=self._apply_filters).grid(row=1, column=4, columnspan=2, sticky="w", pady=(8, 0))
        for combo in (self.project_filter, self.scope_filter, self.domain_filter, self.event_filter, self.subevent_filter):
            combo.bind("<<ComboboxSelected>>", lambda _event: self._on_filter_changed())

        self.main = ttk.Panedwindow(self, orient=tk.HORIZONTAL)
        self.main.grid(row=3, column=0, sticky="nsew", padx=16, pady=(0, 12))

        left = ttk.Frame(self.main, padding=12)
        right = ttk.Notebook(self.main)
        self.main.add(left, weight=3)
        self.main.add(right, weight=2)

        left.columnconfigure(0, weight=1)
        left.rowconfigure(1, weight=1)

        table_header = ttk.Frame(left)
        table_header.grid(row=0, column=0, sticky="ew", pady=(0, 8))
        ttk.Label(table_header, text="Voice lines", font=("Helvetica", 13, "bold")).grid(row=0, column=0, sticky="w")
        ttk.Label(table_header, text="Browse, edit, review, and generate local SQLite voice lines.", style="Subtle.TLabel").grid(row=1, column=0, sticky="w", pady=(2, 0))

        table_frame = ttk.Frame(left)
        table_frame.grid(row=1, column=0, sticky="nsew")
        table_frame.columnconfigure(0, weight=1)
        table_frame.rowconfigure(0, weight=1)

        columns = ("project", "scope", "domain", "event", "subevent", "title", "text", "review", "asset")
        self.tree = ttk.Treeview(table_frame, columns=columns, show="headings", selectmode="extended")
        self.tree.heading("project", text="Project")
        self.tree.heading("scope", text="Scope")
        self.tree.heading("domain", text="Phase / Domain")
        self.tree.heading("event", text="Event")
        self.tree.heading("subevent", text="Subevent")
        self.tree.heading("title", text="Cue note")
        self.tree.heading("text", text="Transcript")
        self.tree.heading("review", text="Review")
        self.tree.heading("asset", text="Asset")

        self.tree.column("project", width=130, anchor="w")
        self.tree.column("scope", width=80, anchor="w")
        self.tree.column("domain", width=140, anchor="w")
        self.tree.column("event", width=110, anchor="w")
        self.tree.column("subevent", width=130, anchor="w")
        self.tree.column("title", width=180, anchor="w")
        self.tree.column("text", width=460, anchor="w")
        self.tree.column("review", width=100, anchor="w")
        self.tree.column("asset", width=100, anchor="w")
        self.tree.grid(row=0, column=0, sticky="nsew")

        yscroll = ttk.Scrollbar(table_frame, orient=tk.VERTICAL, command=self.tree.yview)
        xscroll = ttk.Scrollbar(table_frame, orient=tk.HORIZONTAL, command=self.tree.xview)
        self.tree.configure(yscrollcommand=yscroll.set, xscrollcommand=xscroll.set)
        yscroll.grid(row=0, column=1, sticky="ns")
        xscroll.grid(row=1, column=0, sticky="ew")

        self.tree.bind("<Button-1>", self._on_tree_click, add="+")
        self.tree.bind("<<TreeviewSelect>>", self._on_select_row)
        self.tree.bind("<Double-Button-1>", self._on_tree_double_click)

        right_detail = ttk.Frame(right, padding=12)
        right_log = ttk.Frame(right, padding=12)
        right_questions = ttk.Frame(right, padding=12)
        right.add(right_detail, text="Details")
        right.add(right_log, text="Log")
        right.add(right_questions, text="Questions")

        right_detail.columnconfigure(0, weight=1)
        right_detail.rowconfigure(1, weight=1)
        right_detail.rowconfigure(3, weight=2)
        right_detail.rowconfigure(4, weight=0)
        ttk.Label(right_detail, text="Selected voice line", font=("Helvetica", 13, "bold")).grid(row=0, column=0, sticky="w")
        self.detail_text = scrolledtext.ScrolledText(right_detail, wrap=tk.WORD, height=10, font=("Helvetica", 11))
        self.detail_text.grid(row=1, column=0, sticky="nsew", pady=(8, 0))
        self.detail_text.configure(state="disabled")

        editor_header = ttk.Frame(right_detail)
        editor_header.grid(row=2, column=0, sticky="ew", pady=(12, 4))
        editor_header.columnconfigure(0, weight=1)
        ttk.Label(editor_header, text="Editable transcript", font=("Helvetica", 12, "bold")).grid(row=0, column=0, columnspan=3, sticky="w")
        self.play_button = ttk.Button(editor_header, text="Play", command=self.play_selected_audio)
        self.play_button.grid(row=1, column=0, sticky="ew", padx=(0, 6), pady=(6, 0))
        self.stop_button = ttk.Button(editor_header, text="Stop", command=self.stop_preview_audio)
        self.stop_button.grid(row=1, column=1, sticky="ew", padx=(0, 6), pady=(6, 0))
        self.add_line_button = ttk.Button(editor_header, text="Add line to cue", command=self.add_line_to_selected_cue)
        self.add_line_button.grid(row=1, column=2, sticky="ew", padx=(0, 6), pady=(6, 0))
        self.add_cue_button = ttk.Button(editor_header, text="Add new cue", command=self.add_new_cue)
        self.add_cue_button.grid(row=2, column=0, sticky="ew", padx=(0, 6), pady=(6, 0))
        self.save_text_button = ttk.Button(editor_header, text="Save text + mark regenerate", command=self.save_selected_text)
        self.save_text_button.grid(row=2, column=1, sticky="ew", padx=(0, 6), pady=(6, 0))
        self.delete_line_button = ttk.Button(editor_header, text="Delete this line", command=self.delete_selected_line)
        self.delete_line_button.grid(row=2, column=2, sticky="ew", padx=(0, 6), pady=(6, 0))
        self.transcript_editor = scrolledtext.ScrolledText(right_detail, wrap=tk.WORD, height=8, font=("Helvetica", 12))
        self.transcript_editor.grid(row=3, column=0, sticky="nsew")

        review_controls = ttk.LabelFrame(right_detail, text="Review status", padding=10)
        review_controls.grid(row=4, column=0, sticky="ew", pady=(10, 0))
        ttk.Label(review_controls, text="Status").grid(row=0, column=0, sticky="w", padx=(0, 6))
        self.review_status_buttons: dict[str, ttk.Button] = {}
        for index, status in enumerate(REVIEW_STATUS_OPTIONS, start=1):
            button = ttk.Button(
                review_controls,
                text=status,
                style="Status.TButton",
                command=lambda value=status: self.save_selected_review(value),
            )
            button.grid(row=0, column=index, sticky="ew", padx=(0, 6))
            self.review_status_buttons[status] = button

        right_log.columnconfigure(0, weight=1)
        right_log.rowconfigure(1, weight=1)
        ttk.Label(right_log, text="Generation log", font=("Helvetica", 13, "bold")).grid(row=0, column=0, sticky="w")
        self.log_text = scrolledtext.ScrolledText(right_log, wrap=tk.WORD, height=20, font=("Helvetica", 10))
        self.log_text.grid(row=1, column=0, sticky="nsew", pady=(8, 0))
        self.log_text.configure(state="disabled")

        # ── Questions tab ──────────────────────────────────────────────────────
        right_questions.columnconfigure(0, weight=1)
        right_questions.rowconfigure(1, weight=1)

        q_header = ttk.Frame(right_questions)
        q_header.grid(row=0, column=0, sticky="ew", pady=(0, 8))
        q_header.columnconfigure(0, weight=1)
        ttk.Label(q_header, text="Questions", font=("Helvetica", 13, "bold")).grid(row=0, column=0, sticky="w")
        ttk.Label(q_header, text="All trivia questions in the SQLite database.", style="Subtle.TLabel").grid(row=1, column=0, sticky="w", pady=(2, 0))

        q_button_row = ttk.Frame(right_questions)
        q_button_row.grid(row=2, column=0, sticky="ew", pady=(8, 0))
        self.q_add_button = ttk.Button(q_button_row, text="Add Questions from JSON", command=self._questions_add_from_json)
        self.q_add_button.grid(row=0, column=0, padx=(0, 8))
        self.q_rebuild_button = ttk.Button(q_button_row, text="Rebuild core.json", command=self._questions_rebuild)
        self.q_rebuild_button.grid(row=0, column=1, padx=(0, 8))
        self.q_refresh_button = ttk.Button(q_button_row, text="Refresh", command=self._questions_refresh)
        self.q_refresh_button.grid(row=0, column=2)

        q_table_frame = ttk.Frame(right_questions)
        q_table_frame.grid(row=1, column=0, sticky="nsew", pady=(8, 0))
        q_table_frame.columnconfigure(0, weight=1)
        q_table_frame.rowconfigure(0, weight=1)

        q_cols = ("id", "category", "difficulty", "question", "audio")
        self.q_tree = ttk.Treeview(q_table_frame, columns=q_cols, show="headings", selectmode="browse")
        self.q_tree.heading("id", text="ID")
        self.q_tree.heading("category", text="Category")
        self.q_tree.heading("difficulty", text="Difficulty")
        self.q_tree.heading("question", text="Question")
        self.q_tree.heading("audio", text="Audio")
        self.q_tree.column("id", width=160, anchor="w")
        self.q_tree.column("category", width=90, anchor="w")
        self.q_tree.column("difficulty", width=80, anchor="center")
        self.q_tree.column("question", width=320, anchor="w")
        self.q_tree.column("audio", width=70, anchor="center")
        self.q_tree.grid(row=0, column=0, sticky="nsew")

        q_yscroll = ttk.Scrollbar(q_table_frame, orient=tk.VERTICAL, command=self.q_tree.yview)
        q_xscroll = ttk.Scrollbar(q_table_frame, orient=tk.HORIZONTAL, command=self.q_tree.xview)
        self.q_tree.configure(yscrollcommand=q_yscroll.set, xscrollcommand=q_xscroll.set)
        q_yscroll.grid(row=0, column=1, sticky="ns")
        q_xscroll.grid(row=1, column=0, sticky="ew")

        self.q_count_var = tk.StringVar(value="")
        ttk.Label(right_questions, textvariable=self.q_count_var, style="Subtle.TLabel").grid(row=3, column=0, sticky="w", pady=(6, 0))

        self.after(150, self._questions_refresh)

        self.status_var = tk.StringVar(value="Ready.")
        status_bar = ttk.Label(self, textvariable=self.status_var, padding=(16, 6))
        status_bar.grid(row=4, column=0, sticky="ew")

    def _set_busy(self, busy: bool, message: str | None = None) -> None:
        self.busy = busy
        state = tk.DISABLED if busy else tk.NORMAL
        self.refresh_button.configure(state=state)
        self.generate_button.configure(state=state)
        self.generate_selected_button.configure(state=state)
        self.save_text_button.configure(state=state)
        for button in self.review_status_buttons.values():
            button.configure(state=state)
        self.play_button.configure(state=state)
        self.stop_button.configure(state=state)
        self.add_line_button.configure(state=state)
        self.add_cue_button.configure(state=state)
        self.delete_line_button.configure(state=state)
        if message is not None:
            self.status_var.set(message)

    def save_settings(self) -> None:
        settings = {
            "apiKey": self.api_key_var.get().strip(),
            "voiceId": self.voice_id_var.get().strip(),
        }
        self.settings = settings
        try:
            save_settings(settings)
            self.status_var.set("Settings saved.")
        except Exception as exc:  # noqa: BLE001
            messagebox.showerror(APP_TITLE, f"Could not save settings: {exc}")

    def _append_log(self, message: str) -> None:
        self.log_text.configure(state="normal")
        self.log_text.insert("end", f"{message}\n")
        self.log_text.see("end")
        self.log_text.configure(state="disabled")

    def _set_detail(self, text: str) -> None:
        self.detail_text.configure(state="normal")
        self.detail_text.delete("1.0", "end")
        self.detail_text.insert("end", text)
        self.detail_text.configure(state="disabled")

    def _update_review_status_buttons(self, status: str) -> None:
        current = normalize_review_status(status)
        for value, button in self.review_status_buttons.items():
            button.configure(style="StatusActive.TButton" if value == current else "Status.TButton")

    def _update_status_filter_buttons(self) -> None:
        current = self.status_filter_var.get()
        for value, button in self.status_filter_buttons.items():
            button.configure(style="StatusActive.TButton" if value == current else "Status.TButton")

    def set_status_filter(self, status: str) -> None:
        self.status_filter_var.set(status if status == "All" else normalize_review_status(status))
        self._update_status_filter_buttons()
        self._on_filter_changed()

    def _poll_queue(self) -> None:
        try:
            while True:
                kind, payload = self.task_queue.get_nowait()
                if kind == "refresh-ok":
                    self.catalog = payload["catalog"]
                    self.review_state = payload["review_state"]
                    self.all_targets = payload["targets"]
                    self._update_filter_options()
                    self._apply_filters()
                    self._update_summary()
                    self._set_busy(False, payload.get("message", "Ready."))
                    self._append_log(payload.get("log", "Refreshed the library snapshot."))
                elif kind == "save-ok":
                    self._append_log(payload.get("log", "Saved transcript."))
                    self._set_busy(False, payload.get("message", "Text saved."))
                    self.refresh_data()
                elif kind == "review-ok":
                    self._append_log(payload.get("log", "Saved review."))
                    self._set_busy(False, payload.get("message", "Review saved."))
                    self.refresh_data()
                elif kind == "create-ok":
                    self._append_log(payload.get("log", "Created voice line."))
                    self._set_busy(False, payload.get("message", "Voice line created."))
                    self.refresh_data()
                elif kind == "generate-ok":
                    self._append_log(payload["log"])
                    self._set_busy(False, payload.get("message", "Ready."))
                    self.refresh_data()
                elif kind == "error":
                    self._set_busy(False, "Something went wrong.")
                    self._append_log(payload)
                    messagebox.showerror(APP_TITLE, str(payload))
        except queue.Empty:
            pass
        self.after(200, self._poll_queue)

    def _update_summary(self) -> None:
        total = len(self.all_targets)
        shown = len(self.targets)
        marked = sum(1 for row in self.all_targets if "regenerate" in row.tags)
        ready = sum(1 for row in self.all_targets if "regenerate" in row.tags and not row.skip_reason)
        skipped = marked - ready
        if total == 0:
            self.summary_var.set("No voice lines found. Check the local SQLite database.")
        else:
            self.summary_var.set(f"{shown} shown • {total} total voice lines • {marked} marked regenerate • {ready} ready • {skipped} skipped")

    def _update_filter_options(self) -> None:
        current = {
            "project": self.project_filter_var.get(),
            "scope": self.scope_filter_var.get(),
            "domain": self.domain_filter_var.get(),
            "event": self.event_filter_var.get(),
            "subevent": self.subevent_filter_var.get(),
            "status": self.status_filter_var.get(),
        }
        for _attempt in range(2):
            options = filter_options_for_selection(
                self.all_targets,
                project=current["project"],
                scope=current["scope"],
                domain=current["domain"],
                event=current["event"],
                status=current["status"],
            )
            self.project_filter.configure(values=options["project"])
            self.scope_filter.configure(values=options["scope"])
            self.domain_filter.configure(values=options["domain"])
            self.event_filter.configure(values=options["event"])
            self.subevent_filter.configure(values=options["subevent"])
            changed = False
            for key, variable in (
                ("project", self.project_filter_var),
                ("scope", self.scope_filter_var),
                ("domain", self.domain_filter_var),
                ("event", self.event_filter_var),
                ("subevent", self.subevent_filter_var),
                ("status", self.status_filter_var),
            ):
                if current[key] not in options[key]:
                    variable.set("All")
                    current[key] = "All"
                    changed = True
            if not changed:
                break
        self._update_status_filter_buttons()

    def _on_filter_changed(self) -> None:
        self._update_filter_options()
        self._apply_filters()

    def _apply_filters(self) -> None:
        project = self.project_filter_var.get()
        scope = self.scope_filter_var.get()
        domain = self.domain_filter_var.get()
        event = self.event_filter_var.get()
        subevent = self.subevent_filter_var.get()
        status = self.status_filter_var.get()
        regenerate_only = self.regenerate_only_var.get()
        self.targets = filter_rows_for_selection(
            self.all_targets,
            project=project,
            scope=scope,
            domain=domain,
            event=event,
            subevent=subevent,
            status=status,
            regenerate_only=regenerate_only,
        )
        self.row_map = {row.candidate_id: row for row in self.targets}
        self._render_rows()
        self._update_summary()

    def _render_rows(self) -> None:
        for item in self.tree.get_children():
            self.tree.delete(item)

        for row in self.targets:
            review_status = normalize_review_status(row.status)
            self.tree.insert(
                "",
                "end",
                iid=row.candidate_id,
                values=(
                    row.project_title,
                    row.scope,
                    row.domain,
                    truncate(row.event_name, 24),
                    truncate(row.subevent_label, 28),
                    truncate(row.group_title, 40),
                    truncate(row.display_text, 88),
                    review_status,
                    row.asset_status,
                ),
                tags=(review_status, "skip") if row.skip_reason else (review_status,),
            )

        self.tree.tag_configure("skip", foreground="#8a8a8a")
        self.tree.tag_configure("pending", background="#eef4ff")
        self.tree.tag_configure("approved", background="#eff8f0")
        self.tree.tag_configure("unreviewed", background="#ffffff")

        if self.tree.get_children():
            first = self.tree.get_children()[0]
            self._selection_anchor_id = first
            self.tree.selection_set(first)
            self.tree.focus(first)
            self._show_row_detail(first)
        else:
            self._selection_anchor_id = None
            self._set_detail("No voice lines found.")
            self.transcript_editor.delete("1.0", "end")

    def _tree_selection_order(self) -> list[str]:
        selected = set(self.tree.selection())
        return [iid for iid in self.tree.get_children() if iid in selected]

    def _set_tree_selection(self, item_ids: list[str], focus_id: str | None = None) -> None:
        ordered = [iid for iid in self.tree.get_children() if iid in item_ids]
        if ordered:
            self.tree.selection_set(ordered)
            focus_target = focus_id or ordered[0]
            self.tree.focus(focus_target)
            self.tree.see(focus_target)
            self._selection_anchor_id = focus_target
        else:
            self.tree.selection_remove(self.tree.selection())
            self._selection_anchor_id = None

    def _on_tree_click(self, event: tk.Event) -> str | None:
        region = self.tree.identify_region(event.x, event.y)
        if region not in {"cell", "tree"}:
            return None
        row_id = self.tree.identify_row(event.y)
        if not row_id:
            return None
        shift_pressed = bool(event.state & 0x0001)
        command_pressed = bool(event.state & 0x0008)
        if shift_pressed:
            children = list(self.tree.get_children())
            anchor_id = self._selection_anchor_id or (self.tree.focus() if self.tree.focus() in self.row_map else None)
            if not anchor_id or anchor_id not in children:
                anchor_id = self._tree_selection_order()[0] if self._tree_selection_order() else row_id
            start = children.index(anchor_id)
            end = children.index(row_id)
            if start <= end:
                selected = children[start : end + 1]
            else:
                selected = children[end : start + 1]
            self._set_tree_selection(selected, focus_id=row_id)
            return "break"
        if command_pressed:
            current = self._tree_selection_order()
            if row_id in current:
                current = [iid for iid in current if iid != row_id]
            else:
                current.append(row_id)
            self._set_tree_selection(current, focus_id=row_id if row_id in current else (current[0] if current else None))
            if row_id not in current:
                self.tree.focus(row_id)
            return "break"
        self._set_tree_selection([row_id], focus_id=row_id)
        return "break"

    _EDITABLE_COLUMNS = {"scope", "domain", "event", "subevent", "title"}
    _ALL_COLUMNS = ("project", "scope", "domain", "event", "subevent", "title", "text", "review", "asset")

    def _on_tree_double_click(self, event: tk.Event) -> None:
        if self.busy:
            return
        if self.tree.identify_region(event.x, event.y) != "cell":
            return
        row_id = self.tree.identify_row(event.y)
        col_id = self.tree.identify_column(event.x)
        if not row_id or not col_id:
            return
        col_index = int(col_id.lstrip("#")) - 1
        if col_index < 0 or col_index >= len(self._ALL_COLUMNS):
            return
        col_name = self._ALL_COLUMNS[col_index]
        if col_name not in self._EDITABLE_COLUMNS:
            return
        row = self.row_map.get(row_id)
        if not row:
            return

        raw = {
            "scope": row.scope,
            "domain": row.domain,
            "event": row.event_name,
            "subevent": row.subevent_label,
            "title": row.group_title,
        }
        current = raw[col_name] or ""

        bbox = self.tree.bbox(row_id, col_id)
        if not bbox:
            return
        x, y, w, h = bbox

        var = tk.StringVar(value=current)
        entry = ttk.Entry(self.tree, textvariable=var, font=("Helvetica", 11))
        entry.place(x=x, y=y, width=w, height=h)
        entry.focus_set()
        entry.selection_range(0, tk.END)

        committed: list[bool] = [False]

        def commit(_evt=None) -> None:
            if committed[0]:
                return
            committed[0] = True
            new_value = var.get().strip()
            entry.destroy()
            if new_value and new_value != current:
                self._apply_cell_edit(row, col_name, new_value, raw)

        def cancel(_evt=None) -> None:
            if committed[0]:
                return
            committed[0] = True
            entry.destroy()

        entry.bind("<Return>", commit)
        entry.bind("<KP_Enter>", commit)
        entry.bind("<Escape>", cancel)
        entry.bind("<FocusOut>", commit)

    def _apply_cell_edit(self, row: "TargetRow", col_name: str, new_value: str, raw: dict[str, str]) -> None:
        cue_key = row.cue_key
        if col_name == "title":
            self._set_busy(True, "Saving cue note…")

            def worker() -> None:
                try:
                    with db_connection() as conn:
                        conn.execute("UPDATE voice_cues SET title = ? WHERE cue_key = ?", (new_value, cue_key))
                        conn.commit()
                    self.task_queue.put(("create-ok", {"message": f'Cue note updated → "{new_value}".', "log": f"Updated title for {cue_key}"}))
                except Exception as exc:  # noqa: BLE001
                    self.task_queue.put(("error", f"Save failed: {exc}"))

            threading.Thread(target=worker, daemon=True).start()
        else:
            new_scope = new_value if col_name == "scope" else raw["scope"]
            new_domain = new_value if col_name == "domain" else raw["domain"]
            new_event = new_value if col_name == "event" else raw["event"]
            new_subevent = new_value if col_name == "subevent" else raw["subevent"]
            self._set_busy(True, "Renaming cue…")

            def worker() -> None:
                try:
                    result = rename_cue(cue_key, new_scope, new_domain, new_event, new_subevent)
                    if result["changed"]:
                        msg = f"Renamed: {result['oldKey']} → {result['newKey']}"
                        self.task_queue.put(("create-ok", {"message": msg, "log": msg}))
                    else:
                        self.task_queue.put(("create-ok", {"message": "No change (same key).", "log": "Rename skipped"}))
                except Exception as exc:  # noqa: BLE001
                    self.task_queue.put(("error", f"Rename failed: {exc}"))

            threading.Thread(target=worker, daemon=True).start()

    def _show_row_detail(self, candidate_id: str) -> None:
        row = self.row_map.get(candidate_id)
        if not row:
            self._set_detail("No details available.")
            return

        segments = split_voice_text(row.display_text)
        detail = [
            f"Line ID: {row.candidate_id}",
            f"Project: {row.project_title}",
            f"Cue: {row.cue_key}",
            f"Cue note: {row.group_title}",
            f"Scope: {row.scope}",
            f"Domain: {row.domain}",
            f"Event path: {row.event_label}",
            f"Trigger: {row.trigger_mode} phase={row.trigger_phase or '-'} event={row.trigger_event_key or '-'} priority={row.trigger_priority} enabled={row.trigger_enabled}",
            f"File: {row.file_name}",
            f"State: {normalize_review_status(row.status)}",
            f"Asset: {row.asset_status}",
            f"Preview: {row.skip_reason or 'ready'}",
            "",
            "Transcript:",
            row.display_text or "(empty)",
            "",
            f"Segments: {len(segments)}",
        ]
        if row.skip_reason:
            detail.extend(["", f"Skip reason: {row.skip_reason}"])
        self._set_detail("\n".join(detail))
        self.transcript_editor.delete("1.0", "end")
        self.transcript_editor.insert("end", row.display_text)
        self.review_status_var.set(normalize_review_status(row.status))
        self._update_review_status_buttons(row.status)

    def _on_select_row(self, _event: object) -> None:
        selection = self._tree_selection_order()
        if not selection:
            return
        self._show_row_detail(selection[0])

    def _fetch_snapshot(self) -> tuple[dict, dict, list[TargetRow]]:
        targets = load_local_lines()
        return {}, {}, targets

    def refresh_data(self) -> None:
        if self.busy:
            return
        self._set_busy(True, "Refreshing library snapshot…")
        self._append_log("Refreshing current Voice Library snapshot.")

        def worker() -> None:
            try:
                catalog, review_state, targets = self._fetch_snapshot()
                self.task_queue.put(
                    (
                        "refresh-ok",
                        {
                            "catalog": catalog,
                            "review_state": review_state,
                            "targets": targets,
                            "message": "Snapshot updated.",
                            "log": f"Loaded {len(targets)} voice line(s) from {DB_PATH}.",
                        },
                    )
                )
            except Exception as exc:  # noqa: BLE001
                self.task_queue.put(("error", f"Refresh failed: {exc}"))

        threading.Thread(target=worker, daemon=True).start()

    def save_selected_text(self) -> None:
        if self.busy:
            return
        selection = self.tree.selection()
        if not selection:
            messagebox.showinfo(APP_TITLE, "Select a voice line before saving text.")
            return
        candidate_id = selection[0]
        transcript = self.transcript_editor.get("1.0", "end").strip()
        if not transcript:
            if not messagebox.askyesno(APP_TITLE, "Save an empty transcript? It will be skipped during generation until text is added."):
                return

        self._set_busy(True, "Saving transcript…")
        self._append_log(f"Saving transcript for {candidate_id}.")

        def worker() -> None:
            try:
                updated = save_local_transcript(candidate_id, transcript)
                self.task_queue.put(
                    (
                        "save-ok",
                        {
                            "message": "Transcript saved and marked regenerate.",
                            "log": f"Saved {updated.get('lineId') or candidate_id}; tags: {', '.join(updated.get('tags') or [])}",
                        },
                    )
                )
            except Exception as exc:  # noqa: BLE001
                self.task_queue.put(("error", f"Save failed: {exc}"))

        threading.Thread(target=worker, daemon=True).start()

    def save_selected_review(self, status: str | None = None) -> None:
        if self.busy:
            return
        row = self._selected_row()
        if not row:
            messagebox.showinfo(APP_TITLE, "Select a voice line before saving review state.")
            return
        status = normalize_review_status(status or self.review_status_var.get())
        self.review_status_var.set(status)
        self._update_review_status_buttons(status)
        self._set_busy(True, "Saving review state…")
        self._append_log(f"Saving review state for {row.candidate_id}.")

        def worker() -> None:
            try:
                updated = save_local_review(row.candidate_id, status=status)
                self.task_queue.put(
                    (
                        "review-ok",
                        {
                            "message": "Review state saved.",
                            "log": f"Saved review for {updated['lineId']}; status: {updated['status']}",
                        },
                    )
                )
            except Exception as exc:  # noqa: BLE001
                self.task_queue.put(("error", f"Review save failed: {exc}"))

        threading.Thread(target=worker, daemon=True).start()
    def stop_preview_audio(self) -> None:
        process = self.preview_process
        self.preview_process = None
        if process and process.poll() is None:
            process.terminate()
        self.status_var.set("Preview stopped.")

    def play_selected_audio(self) -> None:
        row = self._selected_row()
        if not row:
            messagebox.showinfo(APP_TITLE, "Select a voice line before previewing audio.")
            return
        file_path = audio_path_to_file_path(row.audio_path)
        if not file_path.exists():
            message = f"Missing audio file: {file_path}"
            self.status_var.set(message)
            self._append_log(message)
            return
        self.stop_preview_audio()
        try:
            self.preview_process = subprocess.Popen(["afplay", str(file_path)])
            self.status_var.set(f"Previewing {row.file_name}.")
        except FileNotFoundError:
            webbrowser.open(file_path.as_uri())
            self.status_var.set(f"Opened {row.file_name} with the system player.")
        except Exception as exc:  # noqa: BLE001
            messagebox.showerror(APP_TITLE, f"Could not play audio: {exc}")

    def _selected_row(self) -> TargetRow | None:
        selection = self._tree_selection_order()
        if not selection:
            return None
        return self.row_map.get(selection[0])

    def _selected_rows(self) -> list[TargetRow]:
        return [self.row_map[row_id] for row_id in self._tree_selection_order() if row_id in self.row_map]

    def _text_dialog(self, title: str, prompt: str, initial: str = "") -> str | None:
        dialog = tk.Toplevel(self)
        dialog.title(title)
        dialog.transient(self)
        dialog.grab_set()
        dialog.geometry("560x320")
        dialog.columnconfigure(0, weight=1)
        dialog.rowconfigure(1, weight=1)
        ttk.Label(dialog, text=prompt, padding=(12, 12, 12, 4)).grid(row=0, column=0, sticky="w")
        text_box = scrolledtext.ScrolledText(dialog, wrap=tk.WORD, height=8, font=("Helvetica", 12))
        text_box.grid(row=1, column=0, sticky="nsew", padx=12, pady=(0, 8))
        text_box.insert("end", initial)
        result: dict[str, str | None] = {"value": None}

        button_row = ttk.Frame(dialog, padding=(12, 0, 12, 12))
        button_row.grid(row=2, column=0, sticky="e")

        def save() -> None:
            result["value"] = text_box.get("1.0", "end").strip()
            dialog.destroy()

        ttk.Button(button_row, text="Cancel", command=dialog.destroy).grid(row=0, column=0, padx=(0, 8))
        ttk.Button(button_row, text="Create", style="Accent.TButton", command=save).grid(row=0, column=1)
        text_box.focus_set()
        self.wait_window(dialog)
        return result["value"]

    def _cue_dialog(self) -> dict | None:
        selected = self._selected_row()
        dialog = tk.Toplevel(self)
        dialog.title("Add cue + first voice line")
        dialog.transient(self)
        dialog.grab_set()
        dialog.geometry("780x680")
        dialog.columnconfigure(0, weight=1)
        dialog.rowconfigure(2, weight=1)

        scope_var = tk.StringVar(value=selected.scope if selected else "phase")
        domain_var = tk.StringVar(value=selected.domain if selected else "answering")
        event_var = tk.StringVar(value=selected.event_name if selected else "")
        subevent_var = tk.StringVar(value=selected.subevent_label if selected else "")
        title_var = tk.StringVar(value="")
        trigger_var = tk.StringVar(value="phase-entry")
        trigger_phase_var = tk.StringVar(value=selected.domain if selected and selected.scope == "phase" else domain_var.get())
        priority_var = tk.StringVar(value="100")

        help_text = "Create one cue/event category, then add its first voice line."
        ttk.Label(dialog, text=help_text, wraplength=720, style="Subtle.TLabel").grid(row=0, column=0, sticky="ew", padx=12, pady=(12, 8))

        cue_frame = ttk.LabelFrame(dialog, text="1. Cue / event category", padding=10)
        cue_frame.grid(row=1, column=0, sticky="ew", padx=12, pady=(0, 10))
        cue_frame.columnconfigure(1, weight=1)

        line_frame = ttk.LabelFrame(dialog, text="2. First voice line inside this cue", padding=10)
        line_frame.grid(row=2, column=0, sticky="nsew", padx=12, pady=(0, 10))
        line_frame.columnconfigure(1, weight=1)
        line_frame.rowconfigure(1, weight=1)

        fields = [
            ("Scope", ttk.Combobox(cue_frame, textvariable=scope_var, values=["phase", "global", "cross"], state="readonly")),
            ("Phase / Domain", ttk.Entry(cue_frame, textvariable=domain_var)),
            ("Event", ttk.Entry(cue_frame, textvariable=event_var)),
            ("Subevent", ttk.Entry(cue_frame, textvariable=subevent_var)),
            ("Cue note", ttk.Entry(cue_frame, textvariable=title_var)),
            ("Trigger mode", ttk.Combobox(cue_frame, textvariable=trigger_var, values=["phase-entry", "event-match", "manual", "fallback-only"], state="readonly")),
            ("Trigger phase", ttk.Entry(cue_frame, textvariable=trigger_phase_var)),
            ("Priority", ttk.Entry(cue_frame, textvariable=priority_var)),
        ]
        for index, (label, widget) in enumerate(fields):
            ttk.Label(cue_frame, text=label).grid(row=index, column=0, sticky="w", padx=(0, 8), pady=5)
            widget.grid(row=index, column=1, sticky="ew", pady=5)

        field_help = "Tips: Cue note is only for display. Priority controls tie-breaking; lower numbers are chosen first. Event-match uses the cue path above automatically."
        ttk.Label(cue_frame, text=field_help, wraplength=700, style="Subtle.TLabel").grid(row=len(fields), column=0, columnspan=2, sticky="ew", pady=(6, 0))

        ttk.Label(line_frame, text="First line text").grid(row=0, column=0, sticky="nw", padx=(0, 8), pady=(0, 6))
        ttk.Label(line_frame, text="This creates line-01 for the cue above. Use Add line to cue later for line-02, line-03, etc.", style="Subtle.TLabel", wraplength=660).grid(row=0, column=1, sticky="ew", pady=(0, 6))
        text_box = scrolledtext.ScrolledText(line_frame, wrap=tk.WORD, height=7, font=("Helvetica", 12))
        text_box.grid(row=1, column=0, columnspan=2, sticky="nsew")
        result: dict[str, dict | None] = {"value": None}

        button_row = ttk.Frame(dialog, padding=(12, 4, 12, 12))
        button_row.grid(row=3, column=0, sticky="e")

        def create() -> None:
            try:
                priority = int(priority_var.get() or "100")
            except ValueError:
                messagebox.showerror(APP_TITLE, "Priority must be a number. Lower numbers are chosen first.")
                return
            event_path = normalize_event_path([event_var.get(), *str(subevent_var.get() or "").split(".")])
            trigger_event_key = ""
            if trigger_var.get() == "event-match" and event_path:
                trigger_event_key = cue_key_for(clean_segment(scope_var.get()), clean_segment(domain_var.get()), event_path)
            payload = {
                "scope": scope_var.get(),
                "domain": domain_var.get(),
                "event": event_var.get(),
                "subevent": subevent_var.get(),
                "title": title_var.get(),
                "transcript": text_box.get("1.0", "end").strip(),
                "trigger_mode": trigger_var.get(),
                "trigger_phase": trigger_phase_var.get(),
                "trigger_event_key": trigger_event_key,
                "priority": priority,
            }
            if not payload["transcript"]:
                messagebox.showerror(APP_TITLE, "First line text is required.")
                return
            result["value"] = payload
            dialog.destroy()

        ttk.Button(button_row, text="Cancel", command=dialog.destroy).grid(row=0, column=0, padx=(0, 8))
        ttk.Button(button_row, text="Create cue + line", style="Accent.TButton", command=create).grid(row=0, column=1)
        self.wait_window(dialog)
        return result["value"]

    def add_line_to_selected_cue(self) -> None:
        if self.busy:
            return
        row = self._selected_row()
        if not row:
            messagebox.showinfo(APP_TITLE, "Select an existing cue before adding a line.")
            return
        transcript = self._text_dialog("Add line to cue", f"New line for {row.cue_key}", "")
        if transcript is None:
            return
        self._set_busy(True, "Creating voice line…")
        self._append_log(f"Adding a new line to {row.cue_key}.")

        def worker() -> None:
            try:
                created = create_local_line(row.cue_key, transcript)
                self.task_queue.put(("create-ok", {"message": "Line created and marked regenerate.", "log": f"Created {created['lineId']}"}))
            except Exception as exc:  # noqa: BLE001
                self.task_queue.put(("error", f"Create line failed: {exc}"))

        threading.Thread(target=worker, daemon=True).start()

    def add_new_cue(self) -> None:
        if self.busy:
            return
        payload = self._cue_dialog()
        if not payload:
            return
        self._set_busy(True, "Creating cue…")
        self._append_log("Creating a new cue and first line.")

        def worker() -> None:
            try:
                created = create_local_cue(**payload)
                self.task_queue.put(("create-ok", {"message": "Cue created and marked regenerate.", "log": f"Created {created['cueKey']} / {created['lineId']}"}))
            except Exception as exc:  # noqa: BLE001
                self.task_queue.put(("error", f"Create cue failed: {exc}"))

        threading.Thread(target=worker, daemon=True).start()

    def delete_selected_line(self) -> None:
        if self.busy:
            return
        row = self._selected_row()
        if not row or not row.candidate_id:
            messagebox.showinfo(APP_TITLE, "Select a voice line first.")
            return
        confirm = messagebox.askyesno(
            APP_TITLE,
            f"Delete this line?\n\n{row.candidate_id}\n\nThis removes the DB record and audio file permanently.",
        )
        if not confirm:
            return
        self._set_busy(True, "Deleting voice line…")
        self._append_log(f"Deleting line {row.candidate_id}.")
        line_id = row.candidate_id

        def worker() -> None:
            try:
                delete_local_line(line_id)
                self.task_queue.put(("create-ok", {"message": "Line deleted.", "log": f"Deleted {line_id}"}))
            except Exception as exc:  # noqa: BLE001
                self.task_queue.put(("error", f"Delete line failed: {exc}"))

        threading.Thread(target=worker, daemon=True).start()

    def _run_generation(self, rows: list[TargetRow], *, title: str, log_prefix: str, line_ids: list[str] | None = None) -> None:
        if self.busy:
            return
        if not rows:
            messagebox.showinfo(APP_TITLE, "Nothing is selected for generation.")
            return

        ready = [row for row in rows if not row.skip_reason]
        skipped = [row for row in rows if row.skip_reason]
        api_key = self.api_key_var.get().strip()
        voice_id = self.voice_id_var.get().strip()
        total_label = "selected" if line_ids else "pending"
        if not messagebox.askyesno(
            APP_TITLE,
            (
                f"{title}\n\n"
                f"Rows: {len(rows)}\n"
                f"Ready: {len(ready)}\n"
                f"Skipped by preview: {len(skipped)}\n\n"
                f"API key: {'set' if api_key else 'server env'}\n"
                f"Voice ID: {voice_id or 'line voice IDs'}\n\n"
                f"The tool will read SQLite locally, generate {total_label} items, update file status, and rebuild the runtime manifest."
            ),
        ):
            return

        self.save_settings()
        self._set_busy(True, f"{log_prefix}…")
        self._append_log(f"Starting generation for {len(rows)} voice line(s).")

        def worker() -> None:
            try:
                response = generate_local_marked(api_key=api_key, voice_id_override=voice_id, line_ids=line_ids)
                generated = response.get("generated", []) or []
                skipped_payload = response.get("skipped", []) or []
                catalog, refreshed_state, targets = self._fetch_snapshot()
                lines = [
                    f"Generated {len(generated)} voice line(s).",
                    f"Skipped {len(skipped_payload)} voice line(s).",
                ]
                for item in generated:
                    lines.append(f"Generated: {item.get('id')} -> {item.get('outputPath')}")
                for item in skipped_payload:
                    lines.append(f"Skipped: {item.get('id')} ({item.get('reason')})")
                if response.get("manifestLog"):
                    lines.append(response["manifestLog"])
                self.task_queue.put(
                    (
                        "generate-ok",
                        {
                            "catalog": catalog,
                            "review_state": refreshed_state,
                            "targets": targets,
                            "message": "Generation complete.",
                            "log": "\n".join(lines),
                        },
                    )
                )
            except Exception as exc:  # noqa: BLE001
                self.task_queue.put(("error", f"Generation failed: {exc}"))

        threading.Thread(target=worker, daemon=True).start()

    def rebuild_cue_library(self) -> None:
        self.rebuild_cue_button.configure(state="disabled", text="Rebuilding...")

        def worker() -> None:
            try:
                log = build_runtime_manifest()
                self.after(0, lambda: messagebox.showinfo(APP_TITLE, f"Cue library rebuilt successfully.\n\n{log}".strip()))
            except Exception as exc:
                self.after(0, lambda: messagebox.showerror(APP_TITLE, f"Cue library build failed:\n{exc}"))
            finally:
                self.after(0, lambda: self.rebuild_cue_button.configure(state="normal", text="Rebuild cue library"))

        threading.Thread(target=worker, daemon=True).start()

    def audit_triggers(self) -> None:
        self.audit_button.configure(state="disabled", text="检查中...")

        def worker() -> None:
            try:
                result = audit_director_triggers()
                triggered = sum(1 for v in result.values() if v)
                untriggered_keys = sorted(k for k, v in result.items() if not v)
                total = len(result)
                summary = f"共 {total} 个 cue，{triggered} 个有触发规则，{total - triggered} 个未触发。"
                if untriggered_keys:
                    summary += "\n\n未触发的 cue keys：\n" + "\n".join(f"  • {k}" for k in untriggered_keys)
                self.after(0, lambda: messagebox.showinfo(APP_TITLE, summary))
            except Exception as exc:
                self.after(0, lambda: messagebox.showerror(APP_TITLE, f"检查失败：{exc}"))
            finally:
                self.after(0, lambda: self.audit_button.configure(state="normal", text="检查触发状态"))

        threading.Thread(target=worker, daemon=True).start()

    def generate_marked(self) -> None:
        marked_targets = [row for row in self.all_targets if should_generate_voice_row(row)]
        if not marked_targets:
            messagebox.showinfo(APP_TITLE, "No pending voices were found to generate.")
            return
        self._run_generation(
            marked_targets,
            title=f"Generate the {len(marked_targets)} pending voice(s) now?",
            log_prefix="Generating pending voices",
        )

    def generate_selected(self) -> None:
        rows = self._selected_rows()
        if not rows:
            messagebox.showinfo(APP_TITLE, "Select one or more voice lines before regenerating.")
            return
        self._run_generation(
            rows,
            title=f"Regenerate the {len(rows)} selected voice line(s) now?",
            log_prefix="Regenerating selected voices",
            line_ids=[row.candidate_id for row in rows],
        )

    # ── Questions tab methods ──────────────────────────────────────────────────

    def _questions_refresh(self) -> None:
        """Reload the questions list from SQLite."""
        for item in self.q_tree.get_children():
            self.q_tree.delete(item)
        questions = load_questions_from_db()
        for q in questions:
            audio_ok = question_audio_exists(q.get("question_audio", ""))
            disabled = not q.get("enabled", 1)
            self.q_tree.insert(
                "", "end",
                values=(
                    q["id"],
                    q["category"],
                    q["difficulty"],
                    truncate(q["question"], 60),
                    "ok" if audio_ok else "missing",
                ),
                tags=("disabled",) if disabled else ("audio-missing",) if not audio_ok else (),
            )
        self.q_tree.tag_configure("disabled", foreground="#aaaaaa")
        self.q_tree.tag_configure("audio-missing", foreground="#cc6600")
        enabled_count = sum(1 for q in questions if q.get("enabled", 1))
        self.q_count_var.set(f"{len(questions)} question(s) total, {enabled_count} enabled")

    def _questions_add_from_json(self) -> None:
        """Open a file dialog, load questions JSON, insert to SQLite, register voice cues."""
        path = filedialog.askopenfilename(
            title="Select questions JSON file",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")],
        )
        if not path:
            return
        try:
            with open(path, encoding="utf-8") as f:
                raw = json.load(f)
        except Exception as exc:
            messagebox.showerror(APP_TITLE, f"Could not read file: {exc}")
            return

        if not isinstance(raw, list):
            messagebox.showerror(APP_TITLE, "JSON must be an array of question objects.")
            return

        # Validate required fields
        required = ["category", "tags", "difficulty", "question",
                    "answerA", "answerB", "answerC", "answerD", "correctAnswer", "fact"]
        errors: list[str] = []
        for i, q in enumerate(raw):
            for field in required:
                if not q.get(field):
                    errors.append(f"Question {i + 1}: missing '{field}'")
            ca = str(q.get("correctAnswer", "")).strip().lower()
            if ca not in ("a", "b", "c", "d"):
                errors.append(f"Question {i + 1}: correctAnswer must be a/b/c/d")
        if errors:
            messagebox.showerror(APP_TITLE, "Validation errors:\n" + "\n".join(errors[:10]))
            return

        # Assign IDs
        existing_ids: set[str] = {self.q_tree.item(iid)["values"][0] for iid in self.q_tree.get_children()}
        auto_assign_ids_and_audio(raw, existing_ids)

        preview = "\n".join(f"  {q['id']} [{q['category']}] {q['question'][:50]}" for q in raw[:10])
        if len(raw) > 10:
            preview += f"\n  … and {len(raw) - 10} more"
        if not messagebox.askyesno(APP_TITLE, f"Add {len(raw)} question(s)?\n\n{preview}"):
            return

        self.q_add_button.configure(state="disabled", text="Adding…")

        def worker() -> None:
            try:
                inserted, skipped = insert_questions_from_json(raw)
                cues_added, cues_skipped = register_question_voice_cues(raw)
                msg = (
                    f"Added {inserted} question(s) to SQLite"
                    + (f", skipped {skipped} duplicate(s)" if skipped else "")
                    + f".\nRegistered {cues_added} voice cue(s)"
                    + (f", skipped {cues_skipped} already present" if cues_skipped else "")
                    + "."
                )
                self.after(0, lambda: self._questions_add_done(msg))
            except Exception as exc:
                self.after(0, lambda: messagebox.showerror(APP_TITLE, f"Failed to add questions: {exc}"))
            finally:
                self.after(0, lambda: self.q_add_button.configure(state="normal", text="Add Questions from JSON"))

        threading.Thread(target=worker, daemon=True).start()

    def _questions_add_done(self, msg: str) -> None:
        self._questions_refresh()
        messagebox.showinfo(APP_TITLE, msg)
        # Also rebuild core.json
        self._questions_rebuild(silent=True)

    def _questions_rebuild(self, *, silent: bool = False) -> None:
        """Run npm run build:trivia to regenerate core.json from SQLite."""
        self.q_rebuild_button.configure(state="disabled", text="Rebuilding…")

        def worker() -> None:
            try:
                result = subprocess.run(
                    ["npm", "run", "build:trivia"],
                    cwd=PROJECT_ROOT,
                    capture_output=True,
                    text=True,
                )
                if result.returncode != 0:
                    raise RuntimeError(result.stderr or result.stdout or "build:trivia failed")
                summary = "\n".join(line for line in result.stdout.splitlines() if line.strip())
                if not silent:
                    self.after(0, lambda: messagebox.showinfo(APP_TITLE, f"core.json rebuilt.\n\n{summary}".strip()))
            except Exception as exc:
                self.after(0, lambda: messagebox.showerror(APP_TITLE, f"Rebuild failed:\n{exc}"))
            finally:
                self.after(0, lambda: self.q_rebuild_button.configure(state="normal", text="Rebuild core.json"))

        threading.Thread(target=worker, daemon=True).start()


def main() -> None:
    app = VoiceLibraryGeneratorApp()
    app.mainloop()


if __name__ == "__main__":
    main()
