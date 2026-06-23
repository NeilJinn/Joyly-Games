from __future__ import annotations

import json
import queue
import threading
import tkinter as tk
from dataclasses import dataclass
from pathlib import Path
from tkinter import messagebox, scrolledtext, ttk
from urllib import error, request
import webbrowser


APP_TITLE = "Voice Library Generator"
API_BASE = "http://127.0.0.1:4173"
VOICE_LIBRARY_URL = f"{API_BASE}/voice-library/"
CONFIG_PATH = Path.home() / ".voice-library-generator.json"


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
    group_title: str
    group_id: str
    candidate_label: str
    candidate_title: str
    file_name: str
    transcript: str
    status: str
    tags: list[str]
    skip_reason: str | None

    @property
    def display_text(self) -> str:
        return self.transcript or self.candidate_label or self.candidate_title or self.file_name or ""


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


def flatten_targets(catalog: dict, review_state: dict) -> list[TargetRow]:
    candidates_state = review_state.get("candidates", {}) if isinstance(review_state, dict) else {}
    rows: list[TargetRow] = []

    for project in catalog.get("projects", []) or []:
        project_title = project.get("title") or project.get("id") or "Untitled project"
        sections = project.get("sections", {}) or {}
        for section_name in ("director", "question"):
            for group in sections.get(section_name, []) or []:
                group_title = group.get("title") or group.get("subtitle") or group.get("phase") or group.get("id") or "Untitled group"
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
                            group_title=group_title,
                            group_id=group_id,
                            candidate_label=candidate.get("label") or "",
                            candidate_title=candidate.get("title") or "",
                            file_name=candidate.get("fileName") or "",
                            transcript=str(transcript or ""),
                            status=status or "unreviewed",
                            tags=tags,
                            skip_reason=skip_reason,
                        )
                    )

    rows.sort(key=lambda row: (row.project_title.lower(), row.group_title.lower(), row.file_name.lower()))
    return rows


class VoiceLibraryGeneratorApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title(APP_TITLE)
        self.geometry("1320x820")
        self.minsize(1080, 720)

        self.task_queue: queue.Queue[tuple[str, object]] = queue.Queue()
        self.busy = False
        self.catalog: dict = {}
        self.review_state: dict = {}
        self.targets: list[TargetRow] = []
        self.row_map: dict[str, TargetRow] = {}
        self.settings = load_settings()
        self.api_key_var = tk.StringVar(value=self.settings.get("apiKey", ""))
        self.voice_id_var = tk.StringVar(value=self.settings.get("voiceId", ""))

        self._build_styles()
        self._build_ui()
        self.after(100, self.refresh_data)
        self.after(200, self._poll_queue)

    def _build_styles(self) -> None:
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except Exception:
            pass
        style.configure("Header.TLabel", font=("Helvetica", 20, "bold"))
        style.configure("Subtle.TLabel", foreground="#666666")
        style.configure("Accent.TButton", font=("Helvetica", 11, "bold"))
        style.configure("Treeview", rowheight=30)
        style.configure("Treeview.Heading", font=("Helvetica", 10, "bold"))

    def _build_ui(self) -> None:
        self.columnconfigure(0, weight=1)
        self.rowconfigure(2, weight=1)

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
        self.generate_button = ttk.Button(button_row, text="Generate marked voices", style="Accent.TButton", command=self.generate_marked)
        self.generate_button.grid(row=0, column=1, padx=(0, 8))
        ttk.Button(button_row, text="Open Voice Library", command=lambda: webbrowser.open(VOICE_LIBRARY_URL)).grid(row=0, column=2)

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

        self.main = ttk.Panedwindow(self, orient=tk.HORIZONTAL)
        self.main.grid(row=2, column=0, sticky="nsew", padx=16, pady=(0, 12))

        left = ttk.Frame(self.main, padding=12)
        right = ttk.Notebook(self.main)
        self.main.add(left, weight=3)
        self.main.add(right, weight=2)

        left.columnconfigure(0, weight=1)
        left.rowconfigure(1, weight=1)

        table_header = ttk.Frame(left)
        table_header.grid(row=0, column=0, sticky="ew", pady=(0, 8))
        ttk.Label(table_header, text="Marked for regeneration", font=("Helvetica", 13, "bold")).grid(row=0, column=0, sticky="w")
        ttk.Label(table_header, text="Rows tagged regenerate, plus anything the server will skip because it's test data or missing text.", style="Subtle.TLabel").grid(row=1, column=0, sticky="w", pady=(2, 0))

        table_frame = ttk.Frame(left)
        table_frame.grid(row=1, column=0, sticky="nsew")
        table_frame.columnconfigure(0, weight=1)
        table_frame.rowconfigure(0, weight=1)

        columns = ("project", "group", "title", "text", "status", "skip")
        self.tree = ttk.Treeview(table_frame, columns=columns, show="headings", selectmode="browse")
        self.tree.heading("project", text="Project")
        self.tree.heading("group", text="Group")
        self.tree.heading("title", text="Voice")
        self.tree.heading("text", text="Transcript")
        self.tree.heading("status", text="State")
        self.tree.heading("skip", text="Preview")
        self.tree.column("project", width=150, anchor="w")
        self.tree.column("group", width=180, anchor="w")
        self.tree.column("title", width=210, anchor="w")
        self.tree.column("text", width=380, anchor="w")
        self.tree.column("status", width=90, anchor="w")
        self.tree.column("skip", width=130, anchor="w")
        self.tree.grid(row=0, column=0, sticky="nsew")

        yscroll = ttk.Scrollbar(table_frame, orient=tk.VERTICAL, command=self.tree.yview)
        xscroll = ttk.Scrollbar(table_frame, orient=tk.HORIZONTAL, command=self.tree.xview)
        self.tree.configure(yscrollcommand=yscroll.set, xscrollcommand=xscroll.set)
        yscroll.grid(row=0, column=1, sticky="ns")
        xscroll.grid(row=1, column=0, sticky="ew")

        self.tree.bind("<<TreeviewSelect>>", self._on_select_row)

        right_detail = ttk.Frame(right, padding=12)
        right_log = ttk.Frame(right, padding=12)
        right.add(right_detail, text="Details")
        right.add(right_log, text="Log")

        right_detail.columnconfigure(0, weight=1)
        right_detail.rowconfigure(1, weight=1)
        ttk.Label(right_detail, text="Selected candidate", font=("Helvetica", 13, "bold")).grid(row=0, column=0, sticky="w")
        self.detail_text = scrolledtext.ScrolledText(right_detail, wrap=tk.WORD, height=20, font=("Helvetica", 11))
        self.detail_text.grid(row=1, column=0, sticky="nsew", pady=(8, 0))
        self.detail_text.configure(state="disabled")

        right_log.columnconfigure(0, weight=1)
        right_log.rowconfigure(1, weight=1)
        ttk.Label(right_log, text="Generation log", font=("Helvetica", 13, "bold")).grid(row=0, column=0, sticky="w")
        self.log_text = scrolledtext.ScrolledText(right_log, wrap=tk.WORD, height=20, font=("Helvetica", 10))
        self.log_text.grid(row=1, column=0, sticky="nsew", pady=(8, 0))
        self.log_text.configure(state="disabled")

        self.status_var = tk.StringVar(value="Ready.")
        status_bar = ttk.Label(self, textvariable=self.status_var, padding=(16, 6))
        status_bar.grid(row=3, column=0, sticky="ew")

    def _set_busy(self, busy: bool, message: str | None = None) -> None:
        self.busy = busy
        state = tk.DISABLED if busy else tk.NORMAL
        self.refresh_button.configure(state=state)
        self.generate_button.configure(state=state)
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

    def _poll_queue(self) -> None:
        try:
            while True:
                kind, payload = self.task_queue.get_nowait()
                if kind == "refresh-ok":
                    self.catalog = payload["catalog"]
                    self.review_state = payload["review_state"]
                    self.targets = payload["targets"]
                    self.row_map = {row.candidate_id: row for row in self.targets}
                    self._render_rows()
                    self._update_summary()
                    self._set_busy(False, payload.get("message", "Ready."))
                    self._append_log(payload.get("log", "Refreshed the library snapshot."))
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
        total = len(self.targets)
        ready = sum(1 for row in self.targets if not row.skip_reason)
        skipped = total - ready
        if total == 0:
            self.summary_var.set("No marked voices found. Mark child items with regenerate in Voice Library, then come back here.")
        else:
            self.summary_var.set(f"{total} marked voices found • {ready} ready to generate • {skipped} will be skipped by preview")

    def _render_rows(self) -> None:
        for item in self.tree.get_children():
            self.tree.delete(item)

        for row in self.targets:
            preview = row.skip_reason or f"{len(split_voice_text(row.display_text))} segment(s)"
            self.tree.insert(
                "",
                "end",
                iid=row.candidate_id,
                values=(
                    row.project_title,
                    truncate(row.group_title, 32),
                    truncate(row.candidate_label or row.candidate_title or row.file_name, 42),
                    truncate(row.display_text, 88),
                    row.status,
                    preview,
                ),
            )
            if row.skip_reason:
                self.tree.item(row.candidate_id, tags=("skip",))

        self.tree.tag_configure("skip", foreground="#8a8a8a")

        if self.tree.get_children():
            first = self.tree.get_children()[0]
            self.tree.selection_set(first)
            self.tree.focus(first)
            self._show_row_detail(first)
        else:
            self._set_detail("No marked voice candidates found.")

    def _show_row_detail(self, candidate_id: str) -> None:
        row = self.row_map.get(candidate_id)
        if not row:
            self._set_detail("No details available.")
            return

        segments = split_voice_text(row.display_text)
        detail = [
            f"Candidate ID: {row.candidate_id}",
            f"Project: {row.project_title}",
            f"Group: {row.group_title}",
            f"File: {row.file_name}",
            f"State: {row.status}",
            f"Tags: {', '.join(row.tags) or 'none'}",
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

    def _on_select_row(self, _event: object) -> None:
        selection = self.tree.selection()
        if not selection:
            return
        self._show_row_detail(selection[0])

    def _fetch_snapshot(self) -> tuple[dict, dict, list[TargetRow]]:
        review_state = read_json_url(f"{API_BASE}/api/voice-library/state")
        catalog = read_json_url(f"{API_BASE}/api/voice-library/catalog")
        targets = flatten_targets(catalog, review_state)
        return catalog, review_state, targets

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
                            "log": f"Loaded {len(targets)} marked candidate(s) from the server.",
                        },
                    )
                )
            except Exception as exc:  # noqa: BLE001
                self.task_queue.put(("error", f"Refresh failed: {exc}"))

        threading.Thread(target=worker, daemon=True).start()

    def generate_marked(self) -> None:
        if self.busy:
            return
        if not self.targets:
            messagebox.showinfo(APP_TITLE, "No tagged voices were found to generate.")
            return

        ready = [row for row in self.targets if not row.skip_reason]
        skipped = [row for row in self.targets if row.skip_reason]
        api_key = self.api_key_var.get().strip()
        voice_id = self.voice_id_var.get().strip()
        if not messagebox.askyesno(
            APP_TITLE,
            (
                f"Generate the {len(self.targets)} marked voice(s) now?\n\n"
                f"Ready: {len(ready)}\n"
                f"Skipped by preview: {len(skipped)}\n\n"
                f"API key: {'set' if api_key else 'server env'}\n"
                f"Voice ID: {voice_id or 'candidate voice IDs'}\n\n"
                "The server will re-read your saved Voice Library state, regenerate the tagged items, and mark regenerated items as pending."
            ),
        ):
            return

        self.save_settings()
        self._set_busy(True, "Generating marked voices…")
        self._append_log(f"Starting generation for {len(self.targets)} marked voice(s).")

        def worker() -> None:
            try:
                review_state = read_json_url(f"{API_BASE}/api/voice-library/state")
                payload: dict[str, object] = {"reviewState": review_state}
                if api_key:
                    payload["apiKey"] = api_key
                if voice_id:
                    payload["voiceIdOverride"] = voice_id
                response = post_json_url(
                    f"{API_BASE}/api/voice-library/regenerate",
                    payload,
                )
                generated = response.get("generated", []) or []
                skipped_payload = response.get("skipped", []) or []
                catalog, refreshed_state, targets = self._fetch_snapshot()
                lines = [
                    f"Generated {len(generated)} candidate(s).",
                    f"Skipped {len(skipped_payload)} candidate(s).",
                ]
                for item in generated:
                    lines.append(f"Generated: {item.get('id')} -> {item.get('outputPath')}")
                for item in skipped_payload:
                    lines.append(f"Skipped: {item.get('id')} ({item.get('reason')})")
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
            except error.HTTPError as exc:
                details = exc.read().decode("utf-8", errors="ignore") if exc.fp else ""
                self.task_queue.put(("error", f"Generation failed: HTTP {exc.code} {exc.reason}\n{details}"))
            except Exception as exc:  # noqa: BLE001
                self.task_queue.put(("error", f"Generation failed: {exc}"))

        threading.Thread(target=worker, daemon=True).start()


def main() -> None:
    app = VoiceLibraryGeneratorApp()
    app.mainloop()


if __name__ == "__main__":
    main()
