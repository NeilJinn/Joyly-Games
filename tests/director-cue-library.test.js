import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getVoiceLibraryCatalog } from "../server/voice-library/catalog.js";
import {
  getCueVariants,
  pickCueVariant,
  resolveCue
} from "../public/games/cosmic-trivia/director/cue-library.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const cuesPath = path.join(projectRoot, "content/games/cosmic-trivia/director/cues.json");
const validScopes = new Set(["phase", "global", "cross"]);

function publicAudioPathToFilePath(audioPath) {
  return path.join(projectRoot, "public", String(audioPath || "").replace(/^\/+/, ""));
}

test("cosmic trivia director cues use the scope/domain/eventPath schema", async () => {
  const registry = JSON.parse(await readFile(cuesPath, "utf8"));
  assert.equal(registry.gameId, "cosmic-trivia");
  assert.ok(Array.isArray(registry.cues));

  for (const cue of registry.cues) {
    assert.ok(validScopes.has(cue.scope), `${cue.cueKey} has invalid scope`);
    assert.ok(cue.domain, `${cue.cueKey} is missing domain`);
    assert.ok(Array.isArray(cue.eventPath) && cue.eventPath.length, `${cue.cueKey} is missing eventPath`);
    assert.equal(cue.cueKey, [cue.scope, cue.domain, ...cue.eventPath].join("."));
    assert.ok(Array.isArray(cue.variants), `${cue.cueKey} variants must be an array`);
    for (const variant of cue.variants) {
      assert.ok(variant.path, `${cue.cueKey} variant is missing path`);
      assert.equal(variant.placeholder, true, `${cue.cueKey} placeholder must be explicit until audio is regenerated`);
      if (variant.placeholder !== true) {
        await access(publicAudioPathToFilePath(variant.path));
      }
    }
  }
});

test("voice library catalog exposes phase/global/cross eventPath tree metadata", () => {
  const catalog = getVoiceLibraryCatalog();
  const project = catalog.projects.find(item => item.id === "cosmic-trivia");
  assert.ok(project);

  const byCueKey = new Map(project.sections.director.map(group => [group.cueKey, group]));
  assert.deepEqual(byCueKey.get("phase.answering.answer.all-in")?.eventPath, ["answer", "all-in"]);
  assert.equal(byCueKey.get("phase.answering.answer.all-in")?.scope, "phase");
  assert.equal(byCueKey.get("phase.answering.answer.all-in")?.domain, "answering");

  assert.deepEqual(byCueKey.get("global.score.hidden.started")?.eventPath, ["hidden", "started"]);
  assert.equal(byCueKey.get("global.score.hidden.started")?.scope, "global");

  assert.deepEqual(byCueKey.get("cross.player.idle.filler")?.eventPath, ["idle", "filler"]);
  assert.equal(byCueKey.get("cross.player.idle.filler")?.scope, "cross");
});

test("runtime cue resolver stays silent while placeholder audio has not been regenerated", () => {
  const questionIntroVariants = getCueVariants("phase.question-intro.question.next");
  assert.equal(questionIntroVariants.length, 0);
  assert.equal(pickCueVariant("phase.question-intro.question.next", "seed").length, 0);

  const fallback = resolveCue("phase.answering.answer.unrecorded");
  assert.equal(fallback.variants.length, 0);

  const invalidScope = resolveCue("unknown.answering.answer.all-in");
  assert.equal(invalidScope.variants.length, 0);
});
