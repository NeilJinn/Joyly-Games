import test from "node:test";
import assert from "node:assert/strict";

import { waitingStatusLabel } from "../public/platform/shared/player-status.js";
import { reconcilePhonePlayerState } from "../public/platform/shared/phone-player-state.js";

test("waitingStatusLabel asks ready players to wait for the rest of the room", () => {
  const label = waitingStatusLabel(
    { id: "p1", ready: true, online: true },
    { status: "waiting", players: [{ id: "p1", ready: true, online: true }] }
  );

  assert.equal(label, "请等待所有玩家准备");
});

test("reconcilePhonePlayerState keeps the edit flow open after a player unreadies", () => {
  const previousPlayer = { id: "p1", ready: true, online: true };
  const nextRoom = {
    status: "waiting",
    players: [{ id: "p1", ready: false, online: true }]
  };

  const result = reconcilePhonePlayerState({
    room: nextRoom,
    playerId: "p1",
    previousPlayer,
    phonePlayerEditing: true
  });

  assert.equal(result.player.ready, false);
  assert.equal(result.phonePlayerEditing, true);
});

test("reconcilePhonePlayerState exits edit mode when the player is ready again", () => {
  const nextRoom = {
    status: "waiting",
    players: [{ id: "p1", ready: true, online: true }]
  };

  const result = reconcilePhonePlayerState({
    room: nextRoom,
    playerId: "p1",
    previousPlayer: { id: "p1", ready: false, online: true },
    phonePlayerEditing: true
  });

  assert.equal(result.phonePlayerEditing, false);
});
