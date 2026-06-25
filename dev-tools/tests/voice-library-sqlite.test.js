import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  createVoiceLibraryDatabase,
  syncVoiceLibraryDatabase,
  listVoiceLibraryLines,
  createVoiceCue,
  createVoiceLine,
  updateVoiceLibraryLineTranscript,
  validateVoiceLibraryAssets
} from "../server/voice-library/sqlite-store.js";
import { getVoiceLibraryCatalog } from "../server/voice-library/catalog.js";

function sampleCatalog(audioPath = "/games/cosmic-trivia/audio/host/director/phase/answering/answer/open/line-01.mp3") {
  return {
    projects: [
      {
        id: "cosmic-trivia",
        title: "Cosmic Trivia",
        sections: {
          director: [
            {
              id: "cosmic-trivia:director:phase.answering.answer.open",
              cueKey: "phase.answering.answer.open",
              title: "进入答题",
              scope: "phase",
              domain: "answering",
              eventPath: ["answer", "open"],
              candidates: [
                {
                  id: "phase.answering.answer.open.line-01",
                  groupId: "cosmic-trivia:director:phase.answering.answer.open",
                  cueKey: "phase.answering.answer.open",
                  projectId: "cosmic-trivia",
                  kind: "director-candidate",
                  title: "line-01.mp3",
                  label: "开始作答，请在手机上选答案。",
                  fileName: "line-01.mp3",
                  audioPath,
                  text: "开始作答，请在手机上选答案。",
                  tone: "warm",
                  audience: "host",
                  visibility: "public-safe",
                  active: true
                }
              ]
            }
          ],
          question: []
        }
      }
    ]
  };
}

test("voice library sqlite store syncs cue, line, and review metadata", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "voice-library-db-"));
  try {
    const db = createVoiceLibraryDatabase(path.join(tempDir, "trivia-content.sqlite"));
    const reviewState = {
      candidates: {
        "phase.answering.answer.open.line-01": {
          status: "unreviewed",
          tags: ["regenerate"],
          transcript: "开始作答。"
        }
      }
    };

    syncVoiceLibraryDatabase(db, { catalog: sampleCatalog(), reviewState });
    const lines = listVoiceLibraryLines(db);

    assert.equal(lines.length, 1);
    assert.equal(lines[0].cueKey, "phase.answering.answer.open");
    assert.equal(lines[0].scope, "phase");
    assert.deepEqual(lines[0].eventPath, ["answer", "open"]);
    assert.equal(lines[0].transcript, "开始作答。");
    assert.deepEqual(lines[0].tags, ["regenerate"]);
    assert.equal(lines[0].assetStatus, "missing-file");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("voice library sqlite store saves edited transcript and marks regenerate", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "voice-library-db-"));
  try {
    const db = createVoiceLibraryDatabase(path.join(tempDir, "trivia-content.sqlite"));
    const reviewState = { candidates: {} };
    syncVoiceLibraryDatabase(db, { catalog: sampleCatalog(), reviewState });

    const updated = updateVoiceLibraryLineTranscript(db, {
      lineId: "phase.answering.answer.open.line-01",
      transcript: "新的答题提示。",
      reviewState
    });

    assert.equal(updated.transcript, "新的答题提示。");
    assert.deepEqual(updated.tags, ["regenerate"]);
    assert.equal(reviewState.candidates["phase.answering.answer.open.line-01"].transcript, "新的答题提示。");
    assert.deepEqual(reviewState.candidates["phase.answering.answer.open.line-01"].tags, ["regenerate"]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("voice library sqlite store validates ready assets when file and text hash match", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "voice-library-db-"));
  try {
    const publicRoot = path.join(tempDir, "public");
    const audioPath = "/games/cosmic-trivia/audio/host/director/phase/answering/answer/open/line-01.mp3";
    const audioFile = path.join(publicRoot, audioPath.replace(/^\/+/, ""));
    await mkdir(path.dirname(audioFile), { recursive: true });
    await writeFile(audioFile, "fake audio");

    const db = createVoiceLibraryDatabase(path.join(tempDir, "trivia-content.sqlite"));
    syncVoiceLibraryDatabase(db, {
      catalog: sampleCatalog(audioPath),
      reviewState: {
        candidates: {
          "phase.answering.answer.open.line-01": {
            status: "pending",
            tags: [],
            transcript: "开始作答，请在手机上选答案。"
          }
        }
      },
      publicRoot
    });

    const result = validateVoiceLibraryAssets(db, { publicRoot });
    const lines = listVoiceLibraryLines(db);

    assert.equal(result.ready, 1);
    assert.equal(lines[0].assetStatus, "ready");
    assert.equal(lines[0].fileSize, 10);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("voice library sqlite store creates new cues with subevents and trigger rules", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "voice-library-db-"));
  try {
    const db = createVoiceLibraryDatabase(path.join(tempDir, "trivia-content.sqlite"));
    const cue = createVoiceCue(db, {
      gameId: "cosmic-trivia",
      projectTitle: "Cosmic Trivia",
      scope: "phase",
      domain: "answering",
      eventPath: ["time", "warning"],
      title: "Time warning",
      triggerMode: "phase-entry",
      phase: "answering",
      priority: 40
    });
    const line = createVoiceLine(db, {
      cueKey: cue.cueKey,
      text: "Tick tock, tiny geniuses. Pick something with confidence.",
      publicRoot: path.join(tempDir, "public")
    });
    const rows = listVoiceLibraryLines(db);

    assert.equal(cue.cueKey, "phase.answering.time.warning");
    assert.equal(line.lineId, "phase.answering.time.warning.line-01");
    assert.equal(line.fileName, "line-01.mp3");
    assert.equal(line.audioPath, "/games/cosmic-trivia/audio/host/director/phase/answering/time/warning/line-01.mp3");
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].eventPath, ["time", "warning"]);
    assert.deepEqual(rows[0].tags, ["regenerate"]);
    assert.equal(rows[0].triggerMode, "phase-entry");
    assert.equal(rows[0].triggerPhase, "answering");
    assert.equal(rows[0].triggerPriority, 40);
    assert.equal(rows[0].assetStatus, "missing-file");
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("voice library sqlite store appends lines to an existing cue with the next file name", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "voice-library-db-"));
  try {
    const db = createVoiceLibraryDatabase(path.join(tempDir, "trivia-content.sqlite"));
    syncVoiceLibraryDatabase(db, { catalog: sampleCatalog(), reviewState: { candidates: {} } });

    const line = createVoiceLine(db, {
      cueKey: "phase.answering.answer.open",
      text: "The answer portal is open. Please do not feed it soup.",
      publicRoot: path.join(tempDir, "public")
    });
    const rows = listVoiceLibraryLines(db).filter(row => row.cueKey === "phase.answering.answer.open");

    assert.equal(line.lineId, "phase.answering.answer.open.line-02");
    assert.equal(line.fileName, "line-02.mp3");
    assert.equal(rows.length, 2);
    assert.ok(rows.some(row => row.id === "phase.answering.answer.open.line-02"));
    assert.deepEqual(rows.find(row => row.id === "phase.answering.answer.open.line-02")?.tags, ["regenerate"]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("voice library sqlite sync preserves existing trigger rules when catalog has no trigger metadata", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "voice-library-db-"));
  try {
    const db = createVoiceLibraryDatabase(path.join(tempDir, "trivia-content.sqlite"));
    createVoiceCue(db, {
      gameId: "cosmic-trivia",
      projectTitle: "Cosmic Trivia",
      scope: "phase",
      domain: "answering",
      eventPath: ["answer", "open"],
      title: "Answer open",
      triggerMode: "phase-entry",
      phase: "answering",
      priority: 20
    });
    syncVoiceLibraryDatabase(db, { catalog: sampleCatalog(), reviewState: { candidates: {} } });

    const row = listVoiceLibraryLines(db).find(item => item.cueKey === "phase.answering.answer.open");
    assert.equal(row.triggerMode, "phase-entry");
    assert.equal(row.triggerPriority, 20);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("voice library catalog exposes question audio as a separate project that syncs to sqlite", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "voice-library-db-"));
  try {
    const catalog = getVoiceLibraryCatalog();
    const questionProject = catalog.projects.find(project => project.id === "cosmic-trivia-questions");
    assert.ok(questionProject);
    assert.equal(questionProject.title, "Cosmic Trivia Questions");
    assert.equal(questionProject.sections.director.length, 0);
    assert.ok(questionProject.sections.question.length > 0);

    const firstQuestionGroup = questionProject.sections.question[0];
    assert.ok(firstQuestionGroup.cueKey.startsWith("question."));
    assert.equal(firstQuestionGroup.scope, "question");
    assert.ok(firstQuestionGroup.domain);
    assert.ok(firstQuestionGroup.eventPath.includes("prompt"));

    const db = createVoiceLibraryDatabase(path.join(tempDir, "trivia-content.sqlite"));
    syncVoiceLibraryDatabase(db, { catalog, reviewState: {}, publicRoot: path.join(tempDir, "public") });
    const questionRows = listVoiceLibraryLines(db, { projectId: "cosmic-trivia-questions" });

    assert.ok(questionRows.length > 0);
    assert.equal(questionRows[0].projectId, "cosmic-trivia-questions");
    assert.equal(questionRows[0].projectTitle, "Cosmic Trivia Questions");
    assert.equal(questionRows[0].kind, "question-candidate");
    assert.equal(questionRows[0].scope, "question");
    assert.ok(questionRows[0].audioPath.includes("/games/cosmic-trivia/audio/"));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
