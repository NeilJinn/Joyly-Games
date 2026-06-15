import test from "node:test";
import assert from "node:assert/strict";

import { isMarketingSurface, pathFromSurface, surfaceFromPath } from "../public/platform/routes.js";

test("surfaceFromPath maps marketing URLs to Joyly marketing surfaces", () => {
  assert.equal(surfaceFromPath("/"), "home");
  assert.equal(surfaceFromPath("/games"), "games");
  assert.equal(surfaceFromPath("/games/"), "games");
  assert.equal(surfaceFromPath("/how-to-play"), "how-to-play");
  assert.equal(surfaceFromPath("/support"), "support");
  assert.equal(surfaceFromPath("/company"), "company");
  assert.equal(surfaceFromPath("/unknown"), "home");
});

test("pathFromSurface returns canonical URLs for marketing pages", () => {
  assert.equal(pathFromSurface("home"), "/");
  assert.equal(pathFromSurface("games"), "/games");
  assert.equal(pathFromSurface("how-to-play"), "/how-to-play");
  assert.equal(pathFromSurface("support"), "/support");
  assert.equal(pathFromSurface("company"), "/company");
  assert.equal(pathFromSurface("not-real"), "/");
});

test("isMarketingSurface only accepts public marketing screens", () => {
  assert.equal(isMarketingSurface("home"), true);
  assert.equal(isMarketingSurface("games"), true);
  assert.equal(isMarketingSurface("setup"), false);
  assert.equal(isMarketingSurface("room"), false);
});
