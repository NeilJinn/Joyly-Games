import unittest

from tools.voice_library_generator import (
    DEFAULT_REGENERATE_ONLY,
    REVIEW_STATUS_OPTIONS,
    TargetRow,
    create_https_context,
    filter_rows_for_selection,
    filter_options_for_selection,
    normalize_review_status,
    should_generate_voice_row,
    subevent_options_for_event,
)


def row(candidate_id: str, event_path: list[str]) -> TargetRow:
    return TargetRow(
        candidate_id=candidate_id,
        project_title="Cosmic Trivia",
        project_id="cosmic-trivia",
        group_title=candidate_id,
        group_id=candidate_id,
        cue_key=candidate_id,
        scope="phase",
        domain="answering",
        event_path=event_path,
        candidate_label="",
        candidate_title="",
        file_name="line-01.mp3",
        audio_path="/games/cosmic-trivia/audio/line-01.mp3",
        transcript="",
        status="unreviewed",
        tags=["regenerate"],
        asset_status="missing-file",
        skip_reason=None,
    )


class VoiceLibraryGeneratorFilterTests(unittest.TestCase):
    def test_subevent_options_follow_selected_event(self) -> None:
        rows = [
            row("phase.answering.time.warning.line-01", ["time", "warning"]),
            row("phase.answering.time.final.line-01", ["time", "final"]),
            row("phase.answering.answer.open.line-01", ["answer", "open"]),
        ]

        self.assertEqual(subevent_options_for_event(rows, "time"), ["All", "final", "warning"])
        self.assertEqual(subevent_options_for_event(rows, "answer"), ["All", "open"])
        self.assertEqual(subevent_options_for_event(rows, "All"), ["All", "final", "open", "warning"])

    def test_filter_options_follow_hierarchy(self) -> None:
        rows = [
            row("phase.answering.time.warning.line-01", ["time", "warning"]),
            row("phase.answering.answer.open.line-01", ["answer", "open"]),
            row("phase.reveal.answer.positive.line-01", ["answer", "positive"]),
        ]
        rows[2].domain = "reveal"

        options = filter_options_for_selection(
            rows,
            project="cosmic-trivia",
            scope="phase",
            domain="answering",
            event="answer",
        )

        self.assertEqual(options["scope"], ["All", "phase"])
        self.assertEqual(options["domain"], ["All", "answering", "reveal"])
        self.assertEqual(options["event"], ["All", "answer", "time"])
        self.assertEqual(options["subevent"], ["All", "open"])

    def test_app_defaults_to_show_all_voice_lines(self) -> None:
        self.assertFalse(DEFAULT_REGENERATE_ONLY)

    def test_review_status_matches_web_editor_model(self) -> None:
        self.assertEqual(REVIEW_STATUS_OPTIONS, ("unreviewed", "pending", "approved"))
        self.assertEqual(normalize_review_status("regenerate"), "unreviewed")
        self.assertEqual(normalize_review_status("pending"), "pending")
        self.assertEqual(normalize_review_status("approved"), "approved")
        self.assertEqual(normalize_review_status(""), "unreviewed")

    def test_status_filter_options_and_row_filtering(self) -> None:
        rows = [
            row("phase.answering.time.warning.line-01", ["time", "warning"]),
            row("phase.answering.answer.open.line-01", ["answer", "open"]),
        ]
        rows[0].status = "pending"
        rows[1].status = "approved"

        options = filter_options_for_selection(rows, status="pending")
        self.assertEqual(options["status"], ["All", "unreviewed", "pending", "approved"])
        self.assertEqual([item.candidate_id for item in filter_rows_for_selection(rows, status="pending")], [rows[0].candidate_id])

    def test_generation_queue_only_includes_pending_rows(self) -> None:
        missing = row("phase.answering.time.warning.line-01", ["time", "warning"])
        missing.tags = []
        missing.asset_status = "missing-file"
        missing.status = "unreviewed"
        pending = row("phase.answering.time.final.line-01", ["time", "final"])
        pending.tags = []
        pending.asset_status = "missing-file"
        pending.status = "pending"
        ready = row("phase.answering.answer.open.line-01", ["answer", "open"])
        ready.tags = ["regenerate"]
        ready.asset_status = "ready"
        ready.status = "approved"

        self.assertFalse(should_generate_voice_row(missing))
        self.assertTrue(should_generate_voice_row(pending))
        self.assertFalse(should_generate_voice_row(ready))

    def test_https_context_can_be_created_for_voice_generation(self) -> None:
        context = create_https_context()
        self.assertTrue(context.verify_mode)


if __name__ == "__main__":
    unittest.main()
