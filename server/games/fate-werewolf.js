export const fateWerewolfGame = {
  id: "fate-werewolf",
  title: "Fate Werewolf",
  genre: "Social deduction ritual",
  price: 8,
  credits: 3,
  players: "5-8",
  minPlayers: 5,
  maxPlayers: 8,
  mood: "Occult moonlit drama",
  status: "playable",
  clientModule: "/games/fate-werewolf/client.js",
  description: "A ceremonial werewolf prototype where fate shapes the table and phones hold private roles."
};

const phaseSteps = {
  "role-reveal": {
    next: "first-night",
    delayMs: 28000,
    headline: "The ritual begins",
    message: "Reveal your role on your phone. The hall stays silent."
  },
  "first-night": {
    next: "night-werewolf",
    delayMs: 8000,
    headline: "First night",
    message: "Night falls over the village."
  },
  "night-werewolf": {
    next: "daybreak",
    delayMs: 26000,
    headline: "Werewolves awaken",
    message: "Wolves quietly choose their first victim."
  },
  daybreak: {
    next: "day-discussion",
    delayMs: 12000,
    headline: "Daytime",
    message: "The village learns what the night has taken."
  },
  "day-discussion": {
    next: "voting",
    delayMs: 45000,
    headline: "Open discussion",
    message: "Speak, accuse, and shape the story."
  },
  voting: {
    next: "results",
    delayMs: 22000,
    headline: "Judgment",
    message: "Every living player casts one vote."
  },
  results: {
    next: "nightfall",
    delayMs: 12000,
    headline: "The rope settles",
    message: "The table witnesses the day's consequence."
  },
  nightfall: {
    next: "night-werewolf",
    delayMs: 8000,
    headline: "Night returns",
    message: "The moon rises again."
  },
  complete: {
    next: null,
    delayMs: null,
    headline: "Fate fulfilled",
    message: "One faction remains."
  }
};

const roleDecksByCount = {
  5: ["werewolf", "oracle", "hunter", "villager", "villager"],
  6: ["werewolf", "oracle", "guardian", "hunter", "villager", "villager"],
  7: ["werewolf", "werewolf", "oracle", "guardian", "hunter", "villager", "villager"],
  8: ["werewolf", "werewolf", "oracle", "guardian", "hunter", "fateweaver", "villager", "villager"]
};

const roleDefinitions = {
  werewolf: {
    id: "werewolf",
    name: "Werewolf",
    team: "wolf",
    cardTitle: "Wolf of the Red Moon",
    summary: "At night, coordinate with the pack and choose a victim.",
    abilityStatus: "Playable in prototype",
    accent: "ember"
  },
  oracle: {
    id: "oracle",
    name: "Oracle",
    team: "moon",
    cardTitle: "Oracle of Cinders",
    summary: "Receives fate-bent insight in the full ruleset.",
    abilityStatus: "Framework only in prototype",
    accent: "gold"
  },
  guardian: {
    id: "guardian",
    name: "Moon Guardian",
    team: "moon",
    cardTitle: "Moon Guardian",
    summary: "Protects one player each night in the full ruleset.",
    abilityStatus: "Framework only in prototype",
    accent: "sage"
  },
  hunter: {
    id: "hunter",
    name: "Hunter",
    team: "moon",
    cardTitle: "Hunter at the Threshold",
    summary: "Can drag another soul down when slain in the full ruleset.",
    abilityStatus: "Framework only in prototype",
    accent: "bone"
  },
  fateweaver: {
    id: "fateweaver",
    name: "Fate Weaver",
    team: "moon",
    cardTitle: "Fate Weaver",
    summary: "Manipulates tarot powers in the full ruleset.",
    abilityStatus: "Framework only in prototype",
    accent: "violet"
  },
  villager: {
    id: "villager",
    name: "Villager",
    team: "moon",
    cardTitle: "Witness of the Village",
    summary: "You carry no spell, only your voice and your memory.",
    abilityStatus: "Playable in prototype",
    accent: "stone"
  }
};

const testerRoleOrder = ["werewolf", "oracle", "guardian", "hunter", "fateweaver", "villager"];

const testerRoleLabels = {
  werewolf: "狼人",
  oracle: "神谕者",
  guardian: "守护者",
  hunter: "猎人",
  fateweaver: "命运编织者",
  villager: "村民"
};

const fateTendencies = {
  omen: { id: "omen", label: "Omen", title: "神谕" },
  shelter: { id: "shelter", label: "Shelter", title: "守护" },
  chaos: { id: "chaos", label: "Chaos", title: "混乱" },
  dusk: { id: "dusk", label: "Dusk", title: "黑暗" }
};

const fateDeck = [
  {
    id: "omen-lantern",
    tendency: "omen",
    title: "Lantern of Murmurs",
    text: "Today the square feels guided. Every player is reminded that yesterday's death revealed no role.",
    scope: "public",
    modifier: { discussionTone: "measured" }
  },
  {
    id: "omen-echo",
    tendency: "omen",
    title: "Echoing Chapel Bell",
    text: "The village is urged to revisit old contradictions before naming fresh suspects.",
    scope: "public",
    modifier: { promptTag: "revisit-claims" }
  },
  {
    id: "omen-thread",
    tendency: "omen",
    title: "Thread of the Seer",
    text: "A hidden player receives a private tarot whisper that may steady their voice.",
    scope: "blessing",
    modifier: { blessingKey: "steady-voice" }
  },
  {
    id: "shelter-slower",
    tendency: "shelter",
    title: "Circle of Ash",
    text: "The village is granted a little more air before judgment. Discussion stretches longer today.",
    scope: "public",
    modifier: { discussionBonusMs: 15000 }
  },
  {
    id: "shelter-silence",
    tendency: "shelter",
    title: "Quiet Hearth",
    text: "The table is reminded to speak carefully. The mood softens and accusations slow down.",
    scope: "public",
    modifier: { discussionTone: "soft" }
  },
  {
    id: "shelter-mark",
    tendency: "shelter",
    title: "Moonlit Feather",
    text: "An anonymous player receives a private token of calm from fate.",
    scope: "blessing",
    modifier: { blessingKey: "calm-mark" }
  },
  {
    id: "chaos-crow",
    tendency: "chaos",
    title: "Crow at the Gallows",
    text: "The room bends toward interruption. Old suspicions feel unstable and fresh theories spread faster.",
    scope: "public",
    modifier: { discussionTone: "volatile" }
  },
  {
    id: "chaos-shiver",
    tendency: "chaos",
    title: "Shiver in the Wheat",
    text: "The village is told that certainty is a trap today. No one should trust an easy answer.",
    scope: "public",
    modifier: { promptTag: "doubt-certainty" }
  },
  {
    id: "chaos-mask",
    tendency: "chaos",
    title: "Mask of the Wanderer",
    text: "An unnamed player receives a private jolt of daring from fate.",
    scope: "blessing",
    modifier: { blessingKey: "daring-step" }
  },
  {
    id: "dusk-fog",
    tendency: "dusk",
    title: "Fog Over the Well",
    text: "The day feels dimmer. The village is warned that memory and instinct may not point the same way.",
    scope: "public",
    modifier: { discussionTone: "grim" }
  },
  {
    id: "dusk-hush",
    tendency: "dusk",
    title: "Hush Beneath the Branches",
    text: "People lower their voices. Players are nudged to watch reactions more than declarations.",
    scope: "public",
    modifier: { promptTag: "watch-reactions" }
  },
  {
    id: "dusk-candle",
    tendency: "dusk",
    title: "Last Candle",
    text: "A hidden player receives a private shadow-blessing from the night.",
    scope: "blessing",
    modifier: { blessingKey: "shadow-candle" }
  }
];

const oracleWhispers = [
  "A dream says the loudest certainty today may still hide fear.",
  "The stars suggest that someone standing near the truth will sound strangely unsure.",
  "A silver thread in your sleep warns that calm voices are not always gentle hearts.",
  "You wake with the sense that yesterday's wound matters more than today's volume.",
  "The omen is vague but persistent: watch who speaks as if the ending is already written.",
  "The moon leaves you one feeling only: hesitation may be wiser than confidence."
];

function stateKey(room) {
  return room.gameState ||= {};
}

function sortedPlayers(room) {
  return [...room.players.values()].sort((a, b) => {
    const joinedDiff = Number(a.joinedAt || 0) - Number(b.joinedAt || 0);
    if (joinedDiff) return joinedDiff;
    return String(a.id).localeCompare(String(b.id));
  });
}

function shuffleWithSeed(items, seedString) {
  const values = [...items];
  let seed = 0;
  for (const character of String(seedString || "fate")) {
    seed = (seed * 31 + character.charCodeAt(0)) >>> 0;
  }
  for (let index = values.length - 1; index > 0; index -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const swapIndex = seed % (index + 1);
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

function dealtRoles(room) {
  const players = sortedPlayers(room);
  const baseDeck = roleDecksByCount[Math.max(5, Math.min(8, players.length))] || roleDecksByCount[5];
  const setupAssignments = room.fateWerewolfSetup?.roleAssignments || {};
  const shuffledPool = shuffleWithSeed(baseDeck.slice(0, players.length), `${room.code}:${players.length}`);
  const assignedByPlayerId = Object.fromEntries(
    players.map(player => [player.id, testerRoleOrder.includes(setupAssignments[player.id]) ? setupAssignments[player.id] : ""])
  );

  for (const assignedRole of Object.values(assignedByPlayerId)) {
    if (!assignedRole) continue;
    const index = shuffledPool.indexOf(assignedRole);
    if (index >= 0) shuffledPool.splice(index, 1);
  }

  return players.map(player => {
    const assignedRole = assignedByPlayerId[player.id];
    if (assignedRole) return assignedRole;
    return shuffledPool.shift() || "villager";
  });
}

function roleState(room, playerId) {
  return stateKey(room).players?.[playerId] || null;
}

function alivePlayerIds(room) {
  return Object.entries(stateKey(room).players || {})
    .filter(([, entry]) => entry.alive)
    .map(([playerId]) => playerId);
}

function alivePlayers(room) {
  return sortedPlayers(room).filter(player => roleState(room, player.id)?.alive);
}

function deadPlayers(room) {
  return sortedPlayers(room).filter(player => !roleState(room, player.id)?.alive);
}

function livingWerewolves(room) {
  return alivePlayers(room).filter(player => roleState(room, player.id)?.role === "werewolf");
}

function livingVillagers(room) {
  return alivePlayers(room).filter(player => roleState(room, player.id)?.role !== "werewolf");
}

function currentStep(room) {
  return phaseSteps[stateKey(room).phase] || phaseSteps["role-reveal"];
}

function currentCycleFate(room) {
  return stateKey(room).fateHistory?.find(entry => entry.cycle === stateKey(room).cycle) || null;
}

function phaseTheme(phase) {
  if (["daybreak", "day-discussion", "voting", "results"].includes(phase)) return "day";
  return "night";
}

function clearPhaseInputs(room) {
  const state = stateKey(room);
  state.night ||= {};
  state.day ||= {};
  state.night.targets = {};
  state.day.votes = {};
}

function phaseTiming(room) {
  const state = stateKey(room);
  const step = currentStep(room);
  const baseDurationMs = state.phase === "day-discussion" ? activeDiscussionDuration(room) : step.delayMs;
  const durationMs = state.phaseDurationOverrideMs ?? baseDurationMs ?? null;
  const startedAt = state.phaseTimerStartedAt || state.phaseStartedAt;
  const endsAt = state.phaseEndsAtOverride || (durationMs != null ? startedAt + durationMs : null);
  const remainingMs = endsAt == null ? null : Math.max(0, endsAt - Date.now());
  return { durationMs, endsAt, remainingMs };
}

function seededIndex(seedString, max) {
  let seed = 0;
  for (const character of String(seedString || "fate")) {
    seed = (seed * 33 + character.charCodeAt(0)) >>> 0;
  }
  return max > 0 ? seed % max : 0;
}

function acknowledgedCount(room) {
  return Object.values(stateKey(room).players || {}).filter(entry => entry.alive && entry.roleAcknowledged).length;
}

function allAlivePlayersAcknowledged(room) {
  const aliveIds = alivePlayerIds(room);
  return aliveIds.length > 0 && aliveIds.every(playerId => roleState(room, playerId)?.roleAcknowledged);
}

function allLivingWerewolvesActed(room) {
  const wolves = livingWerewolves(room);
  if (!wolves.length) return true;
  const targets = stateKey(room).night?.targets || {};
  return wolves.every(player => Boolean(targets[player.id]));
}

function allLivingPlayersVoted(room) {
  const living = alivePlayers(room);
  if (!living.length) return false;
  const votes = stateKey(room).day?.votes || {};
  return living.every(player => Boolean(votes[player.id]));
}

function allDeadPlayersFateVoted(room) {
  const dead = deadPlayers(room);
  if (!dead.length) return true;
  const votes = stateKey(room).fateCouncil?.votes || {};
  return dead.every(player => Boolean(votes[player.id]));
}

function killPlayer(room, playerId, reason) {
  const playerEntry = roleState(room, playerId);
  if (!playerEntry || !playerEntry.alive) return false;
  playerEntry.alive = false;
  playerEntry.eliminatedAtCycle = stateKey(room).cycle;
  playerEntry.eliminationReason = reason;
  return true;
}

function majorityTarget(targetMap = {}) {
  const tally = new Map();
  for (const targetId of Object.values(targetMap)) {
    tally.set(targetId, (tally.get(targetId) || 0) + 1);
  }
  if (!tally.size) return null;
  const ranked = [...tally.entries()].sort((left, right) => right[1] - left[1]);
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return null;
  return ranked[0][0];
}

function resolveNight(room) {
  const state = stateKey(room);
  const targetId = majorityTarget(state.night?.targets || {});
  const victimState = targetId ? roleState(room, targetId) : null;
  if (victimState?.alive && victimState.role !== "werewolf") {
    killPlayer(room, targetId, "night");
    state.lastNightVictimId = targetId;
    state.lastOutcome = "The village wakes to a body and too many unanswered questions.";
  } else {
    state.lastNightVictimId = null;
    state.lastOutcome = "No blood stains the village square this morning.";
  }
  state.lastVoteResult = null;
  state.night.targets = {};
}

function resolveVoting(room) {
  const state = stateKey(room);
  const targetId = majorityTarget(state.day?.votes || {});
  if (!targetId) {
    state.lastVoteResult = { targetId: null, tied: true };
    state.lastOutcome = "The village could not agree. Suspicion survives another night.";
    state.day.votes = {};
    return;
  }

  const targetState = roleState(room, targetId);
  if (!targetState?.alive) {
    state.lastVoteResult = { targetId: null, tied: false };
    state.lastOutcome = "The condemned slipped through the village's fingers.";
    state.day.votes = {};
    return;
  }

  killPlayer(room, targetId, "vote");
  state.lastVoteResult = { targetId, tied: false };
  state.lastOutcome = "The rope tightens. Fate accepts the village's choice.";
  state.day.votes = {};
}

function winnerSummary(team) {
  if (team === "moon") {
    return {
      winner: "moon",
      title: "Moon faction victory",
      body: "Every werewolf has fallen. The village claims the dawn."
    };
  }
  return {
    winner: "wolf",
    title: "Wolf faction victory",
    body: "Only the wolves remain alive. The moon belongs to them."
  };
}

function checkVictory(room) {
  const state = stateKey(room);
  const wolves = livingWerewolves(room);
  const villagers = livingVillagers(room);
  if (!wolves.length) {
    state.victory = winnerSummary("moon");
    return state.victory;
  }
  if (!villagers.length) {
    state.victory = winnerSummary("wolf");
    return state.victory;
  }
  state.victory = null;
  return null;
}

function setPhase(room, phase) {
  const state = stateKey(room);
  state.phase = phase;
  state.phaseStartedAt = Date.now();
  state.phaseDurationOverrideMs = null;
  state.phaseEndsAtOverride = null;
  state.phaseTimerStartedAt = null;
}

function publicPlayerSeat(room, player) {
  const secret = roleState(room, player.id);
  return {
    id: player.id,
    nickname: player.nickname,
    avatar: player.avatar || null,
    online: player.online !== false,
    alive: Boolean(secret?.alive),
    eliminatedAtCycle: secret?.eliminatedAtCycle || null,
    eliminationReason: secret?.eliminationReason || null
  };
}

function currentVoteCount(room) {
  return Object.keys(stateKey(room).day?.votes || {}).length;
}

function currentNightActionCount(room) {
  return Object.keys(stateKey(room).night?.targets || {}).length;
}

function publicHeadline(room) {
  const state = stateKey(room);
  if (state.phase === "complete" && state.victory) return state.victory.title;
  return currentStep(room).headline;
}

function publicMessage(room) {
  const state = stateKey(room);
  if (state.phase === "complete" && state.victory) return state.victory.body;
  return state.lastOutcome || currentStep(room).message;
}

function weightedFateCards(room) {
  const state = stateKey(room);
  const votes = Object.values(state.fateCouncil?.votes || {});
  const weights = { omen: 1, shelter: 1, chaos: 1, dusk: 1 };
  for (const vote of votes) {
    if (weights[vote] != null) weights[vote] += 2;
  }
  return fateDeck.flatMap(card => {
    const count = Math.max(1, weights[card.tendency] || 1);
    return Array.from({ length: count }, () => card);
  });
}

function pickBlessedPlayer(room) {
  const living = alivePlayers(room);
  if (!living.length) return null;
  const index = seededIndex(`${room.code}:${stateKey(room).cycle}:blessing`, living.length);
  return living[index]?.id || null;
}

function blessingCopy(blessingKey) {
  const copy = {
    "steady-voice": "Fate brushes your shoulder. If you speak today, you may claim to feel unusually centered.",
    "calm-mark": "A private calm settles over you. This blessing changes no rules, but you may choose to reveal it.",
    "daring-step": "Fate dares you to be bolder than usual today. Use that as you wish.",
    "shadow-candle": "A last candle burns for you alone. Keep this secret or share it at your own risk."
  };
  return copy[blessingKey] || "Fate touched you today, though only lightly.";
}

function drawFateCard(room) {
  const state = stateKey(room);
  const weightedDeck = weightedFateCards(room);
  const drawn = weightedDeck[seededIndex(`${room.code}:${state.cycle}:fate-draw`, weightedDeck.length)] || fateDeck[0];
  const blessingPlayerId = drawn.scope === "blessing" ? pickBlessedPlayer(room) : null;
  state.fateHistory ||= [];
  state.currentDayModifier = drawn.modifier || {};
  state.currentBlessing = blessingPlayerId ? {
    playerId: blessingPlayerId,
    blessingKey: drawn.modifier?.blessingKey || ""
  } : null;
  const record = {
    cycle: state.cycle,
    cardId: drawn.id,
    tendency: drawn.tendency,
    title: drawn.title,
    text: drawn.text,
    scope: drawn.scope,
    tendencyLabel: fateTendencies[drawn.tendency]?.title || drawn.tendency
  };
  state.fateHistory = [...state.fateHistory.filter(entry => entry.cycle !== state.cycle), record];
  state.fateCouncil ||= { votes: {} };
  state.fateCouncil.lastResult = {
    cycle: state.cycle,
    dominantTendency: record.tendency,
    dominantTitle: record.tendencyLabel
  };
  state.fateCouncil.votes = {};
}

function activeDiscussionDuration(room) {
  const base = phaseSteps["day-discussion"].delayMs || 0;
  const bonus = Number(stateKey(room).currentDayModifier?.discussionBonusMs || 0);
  return base + bonus;
}

function refreshOracleWhisper(room) {
  const state = stateKey(room);
  const oracle = sortedPlayers(room).find(player => roleState(room, player.id)?.role === "oracle");
  if (!oracle || !roleState(room, oracle.id)?.alive) return;
  const whisper = oracleWhispers[seededIndex(`${room.code}:${state.cycle}:oracle`, oracleWhispers.length)];
  state.oracle ||= {};
  state.oracle.current = {
    cycle: state.cycle,
    text: whisper
  };
}

export async function createFateWerewolfState(room) {
  const players = sortedPlayers(room);
  const roles = dealtRoles(room);
  room.gameState = {
    phase: "role-reveal",
    phaseStartedAt: Date.now(),
    phaseDurationOverrideMs: null,
    phaseEndsAtOverride: null,
    phaseTimerStartedAt: null,
    cycle: 1,
    players: Object.fromEntries(players.map((player, index) => {
      const role = roles[index] || "villager";
      return [player.id, {
        role,
        team: roleDefinitions[role]?.team || "moon",
        alive: true,
        roleAcknowledged: false,
        eliminatedAtCycle: null,
        eliminationReason: null
      }];
    })),
    seatOrder: players.map(player => player.id),
    night: { targets: {} },
    day: { votes: {} },
    fateCouncil: { votes: {}, lastResult: null },
    fateHistory: [],
    currentDayModifier: {},
    currentBlessing: null,
    oracle: { current: null },
    lastNightVictimId: null,
    lastVoteResult: null,
    lastOutcome: "The cards are dealt. No one speaks above a whisper.",
    victory: null
  };
}

export async function ensureFateWerewolfState(room) {
  if (!room.gameState) await createFateWerewolfState(room);
}

export function fateWerewolfSetupState(room) {
  const assignments = room.fateWerewolfSetup?.roleAssignments || {};
  return {
    roleOptions: [
      { id: "", name: "随机身份" },
      ...testerRoleOrder.map(roleId => ({
        id: roleId,
        name: testerRoleLabels[roleId] || roleDefinitions[roleId]?.name || roleId
      }))
    ],
    roleAssignments: assignments
  };
}

export async function setFateWerewolfTesterRole(room, playerId, roleId = "") {
  room.fateWerewolfSetup ||= { roleAssignments: {} };
  room.fateWerewolfSetup.roleAssignments ||= {};
  const nextRoleId = testerRoleOrder.includes(String(roleId)) ? String(roleId) : "";
  if (!room.players.has(String(playerId))) {
    return { status: 404, error: "Player not found" };
  }
  if (nextRoleId) room.fateWerewolfSetup.roleAssignments[String(playerId)] = nextRoleId;
  else delete room.fateWerewolfSetup.roleAssignments[String(playerId)];
  return { status: 200 };
}

export function publicFateWerewolfState(room) {
  if (!room.gameState) return null;
  const state = stateKey(room);
  const timing = phaseTiming(room);
  const livingCount = alivePlayers(room).length;
  const voteCount = currentVoteCount(room);
  const nightActions = currentNightActionCount(room);
  const cycleFate = currentCycleFate(room);

  return {
    phase: state.phase,
    phaseGroup: phaseTheme(state.phase),
    phaseStartedAt: state.phaseStartedAt,
    phaseEndsAt: timing.endsAt,
    phaseDurationMs: timing.durationMs || 0,
    remainingMs: timing.remainingMs || 0,
    cycle: state.cycle,
    headline: publicHeadline(room),
    directorMessage: publicMessage(room),
    livingCount,
    eliminatedCount: sortedPlayers(room).length - livingCount,
    seats: sortedPlayers(room).map(player => publicPlayerSeat(room, player)),
    acknowledgedCount: acknowledgedCount(room),
    expectedAcknowledgedCount: alivePlayerIds(room).length,
    currentVoteCount: voteCount,
    expectedVoteCount: alivePlayerIds(room).length,
    currentNightActionCount: nightActions,
    expectedNightActionCount: livingWerewolves(room).length,
    currentFateCard: cycleFate,
    fateResult: state.fateCouncil?.lastResult || null,
    deadVoteCount: Object.keys(state.fateCouncil?.votes || {}).length,
    expectedDeadVoteCount: deadPlayers(room).length,
    lastNightVictimId: state.lastNightVictimId,
    lastVoteResult: state.lastVoteResult,
    prototypeNotes: [
      "This slice now includes fate voting for dead players, one daily fate card, and a private oracle whisper.",
      "Guardian, hunter, lovers, and the deeper destiny deck logic still remain placeholder-ready."
    ]
  };
}

export function privateFateWerewolfState(room, playerId) {
  const player = room.players.get(String(playerId));
  const state = roleState(room, String(playerId));
  if (!player || !state) return null;

  const roleDefinition = roleDefinitions[state.role] || roleDefinitions.villager;
  const publicState = publicFateWerewolfState(room);
  const livingTargets = alivePlayers(room)
    .filter(candidate => candidate.id !== player.id)
    .filter(candidate => {
      const candidateState = roleState(room, candidate.id);
      if (!candidateState?.alive) return false;
      if (roleDefinition.id === "werewolf") return candidateState.role !== "werewolf";
      return true;
    })
    .map(candidate => ({
      id: candidate.id,
      nickname: candidate.nickname
    }));

  const packmates = state.role === "werewolf"
    ? livingWerewolves(room)
        .filter(candidate => candidate.id !== player.id)
        .map(candidate => ({ id: candidate.id, nickname: candidate.nickname }))
    : [];

  let action = null;
  if (room.gameState.phase === "role-reveal" && state.alive) {
    action = {
      type: "confirm-role",
      label: state.roleAcknowledged ? "Role confirmed" : "I have seen my role",
      disabled: state.roleAcknowledged
    };
  } else if (room.gameState.phase === "night-werewolf" && state.alive && state.role === "werewolf") {
    action = {
      type: "night-target",
      label: "Choose a victim",
      selectedTargetId: stateKey(room).night?.targets?.[player.id] || "",
      targets: livingTargets
    };
  } else if (room.gameState.phase === "voting" && state.alive) {
    action = {
      type: "vote-target",
      label: "Cast your vote",
      selectedTargetId: stateKey(room).day?.votes?.[player.id] || "",
      targets: livingTargets
    };
  } else if (!state.alive && ["first-night", "nightfall"].includes(room.gameState.phase)) {
    action = {
      type: "fate-vote",
      label: "Cast a fate tendency",
      selectedTendency: stateKey(room).fateCouncil?.votes?.[player.id] || "",
      tendencies: Object.values(fateTendencies)
    };
  }

  return {
    playerId: player.id,
    nickname: player.nickname,
    alive: state.alive,
    phase: publicState.phase,
    team: state.team,
    role: roleDefinition,
    roleAcknowledged: state.roleAcknowledged,
    packmates,
    oracleWhisper: state.role === "oracle" ? stateKey(room).oracle?.current || null : null,
    privateBlessing: stateKey(room).currentBlessing?.playerId === player.id
      ? blessingCopy(stateKey(room).currentBlessing?.blessingKey || "")
      : "",
    action,
    promptTitle: publicState.headline,
    promptBody: action
      ? currentStep(room).message
      : state.alive
        ? "Stay watchful. Your next meaningful action will appear here."
        : "You are dead. You still watch the public square and may steer the next day's fate."
  };
}

export function directorDelay(room) {
  const state = stateKey(room);
  const timing = phaseTiming(room);
  if (state.phase === "role-reveal" && allAlivePlayersAcknowledged(room) && !state.phaseEndsAtOverride) return 1800;
  if (state.phase === "night-werewolf" && allLivingWerewolvesActed(room) && !state.phaseEndsAtOverride) return 2500;
  if (state.phase === "voting" && allLivingPlayersVoted(room) && !state.phaseEndsAtOverride) return 2500;
  if (["first-night", "nightfall"].includes(state.phase) && allDeadPlayersFateVoted(room) && !state.phaseEndsAtOverride) return 1800;
  return timing.remainingMs;
}

export async function advanceFateWerewolf(room) {
  await ensureFateWerewolfState(room);
  const state = stateKey(room);
  const step = currentStep(room);
  if (!step.next) return;

  if (state.phase === "night-werewolf") {
    resolveNight(room);
    const victory = checkVictory(room);
    if (victory) {
      setPhase(room, "complete");
      return;
    }
    drawFateCard(room);
    refreshOracleWhisper(room);
    setPhase(room, "daybreak");
    return;
  }

  if (state.phase === "voting") {
    resolveVoting(room);
    const victory = checkVictory(room);
    if (victory) {
      setPhase(room, "complete");
      return;
    }
    setPhase(room, "results");
    return;
  }

  if (state.phase === "results") {
    const victory = checkVictory(room);
    if (victory) {
      setPhase(room, "complete");
      return;
    }
    state.cycle += 1;
    clearPhaseInputs(room);
    state.currentDayModifier = {};
    state.currentBlessing = null;
    setPhase(room, "nightfall");
    state.lastOutcome = "The village drifts back into darkness.";
    return;
  }

  if (state.phase === "nightfall") {
    clearPhaseInputs(room);
    setPhase(room, "night-werewolf");
    state.lastOutcome = "The wolves move again under a different moon.";
    return;
  }

  setPhase(room, step.next);
}

export async function restartFateWerewolf(room) {
  await createFateWerewolfState(room);
}

export async function actionFateWerewolf(room, playerId, payload = {}) {
  await ensureFateWerewolfState(room);
  const player = room.players.get(String(playerId));
  const secret = roleState(room, String(playerId));
  if (!player || !secret) return { status: 404, error: "Player not found" };

  const state = stateKey(room);
  const type = String(payload.type || "");
  const targetId = String(payload.targetId || "");
  const tendency = String(payload.tendency || "");

  if (type === "confirm-role") {
    if (state.phase !== "role-reveal") return { status: 409, error: "Role reveal is closed" };
    if (!secret.alive) return { status: 409, error: "Dead players cannot confirm a role" };
    secret.roleAcknowledged = true;
    return {
      status: 200,
      allSubmitted: allAlivePlayersAcknowledged(room),
      private: privateFateWerewolfState(room, playerId)
    };
  }

  if (type === "night-target") {
    if (state.phase !== "night-werewolf") return { status: 409, error: "Night targeting is closed" };
    if (!secret.alive || secret.role !== "werewolf") return { status: 403, error: "Only living werewolves can act here" };
    const targetSecret = roleState(room, targetId);
    if (!targetId || !targetSecret?.alive || targetSecret.role === "werewolf") {
      return { status: 400, error: "Choose a living non-wolf target" };
    }
    state.night.targets[playerId] = targetId;
    return {
      status: 200,
      allSubmitted: allLivingWerewolvesActed(room),
      private: privateFateWerewolfState(room, playerId)
    };
  }

  if (type === "vote-target") {
    if (state.phase !== "voting") return { status: 409, error: "Voting is closed" };
    if (!secret.alive) return { status: 403, error: "Dead players cannot vote" };
    const targetSecret = roleState(room, targetId);
    if (!targetId || !targetSecret?.alive || targetId === playerId) {
      return { status: 400, error: "Choose another living player" };
    }
    state.day.votes[playerId] = targetId;
    return {
      status: 200,
      allSubmitted: allLivingPlayersVoted(room),
      private: privateFateWerewolfState(room, playerId)
    };
  }

  if (type === "fate-vote") {
    if (secret.alive) return { status: 403, error: "Only dead players can steer fate" };
    if (!["first-night", "nightfall"].includes(state.phase)) {
      return { status: 409, error: "The Fate Council is asleep right now" };
    }
    if (!fateTendencies[tendency]) return { status: 400, error: "Choose a valid fate tendency" };
    state.fateCouncil ||= { votes: {}, lastResult: null };
    state.fateCouncil.votes[playerId] = tendency;
    return {
      status: 200,
      allSubmitted: allDeadPlayersFateVoted(room),
      private: privateFateWerewolfState(room, playerId)
    };
  }

  return { status: 400, error: "Unknown action" };
}

export const fateWerewolfRuntime = {
  createState: createFateWerewolfState,
  ensureState: ensureFateWerewolfState,
  setupState: fateWerewolfSetupState,
  testerRole: setFateWerewolfTesterRole,
  publicState: publicFateWerewolfState,
  privateState: privateFateWerewolfState,
  action: actionFateWerewolf,
  restart: restartFateWerewolf,
  advance: advanceFateWerewolf,
  directorDelay
};
