import { coreRoleIds, getRole, nightStepsForRoles, thirdPartyVictoryHooks } from './roles/registry.js'
import { resolveNight as resolveNightOutcome } from './resolvers/night.js'
import { resolveVictory } from './resolvers/victory.js'
import { drawFateCard as selectFateCard } from './fate/cards.js'

function stateOf(room) { return room.gameState }

function nightStepsForRoom(room) {
  const state = stateOf(room)
  const livingRoles = Object.values(state.players || {}).filter(player => player.alive).map(player => player.role)
  return nightStepsForRoles(livingRoles, { firstNight: state.round === 1 })
}

function firstNightStep(room) { return nightStepsForRoom(room)[0] ?? null }

function nextNightStep(room) {
  const steps = nightStepsForRoom(room)
  const idx = steps.indexOf(stateOf(room).nightStep)
  return idx >= 0 && idx + 1 < steps.length ? steps[idx + 1] : null
}

function phaseTheme(phase) {
  return ['fate-card-reveal', 'fate-blessing', 'night-results', 'discussion-r1', 'discussion-r2', 'voting', 'pk-discussion', 'pk-voting', 'execution', 'victory-check'].includes(phase) ? 'day' : 'night'
}

function setPhase(room, phase) {
  stateOf(room).phase = phase
  stateOf(room).phaseStartedAt = Date.now()
}

// Core mode only: every core role appears by ten players.
export const coreRoleDecksByCount = Object.freeze({
  6:  ['werewolf', 'werewolf',                            'oracle', 'fateweaver',                                    'villager', 'villager'],
  7:  ['werewolf', 'werewolf',                            'oracle', 'fateweaver', 'hunter',                          'villager', 'villager'],
  8:  ['werewolf', 'werewolf',                            'oracle', 'fateweaver', 'hunter',                          'villager', 'villager', 'villager'],
  9:  ['werewolf', 'werewolf', 'werewolf',                'oracle', 'fateweaver', 'hunter',                          'villager', 'villager', 'villager'],
  10: ['werewolf', 'werewolf', 'werewolf',                'oracle', 'fateweaver', 'hunter', 'guardian',              'villager', 'villager', 'villager'],
})

/** Returns a fresh, validated core-mode deck for exactly 6–10 players. */
export function getCoreRoleDeck(playerCount) {
  const deck = coreRoleDecksByCount[playerCount]
  if (!deck) throw new Error(`Core mode supports 6–10 players; received ${playerCount}`)
  if (deck.length !== playerCount) throw new Error(`Invalid ${playerCount}-player core deck length`)
  for (const roleId of deck) {
    if (!coreRoleIds.includes(roleId)) throw new Error(`Invalid ${playerCount}-player core deck role: ${roleId}`)
  }
  return [...deck]
}

function validateRoleAssignments(room, deck) {
  const assignments = room.fateWerewolfSetup?.roleAssignments ?? {}
  const remaining = new Map()
  for (const roleId of deck) remaining.set(roleId, (remaining.get(roleId) ?? 0) + 1)

  for (const [playerId, roleId] of Object.entries(assignments)) {
    if (!room.players.has(playerId)) throw new Error(`Role assignment references unknown player: ${playerId}`)
    if (!coreRoleIds.includes(roleId)) throw new Error(`Role assignment is not a registered core role: ${roleId}`)
    const available = remaining.get(roleId) ?? 0
    if (available < 1) throw new Error(`Role assignment exceeds the ${deck.length}-player deck multiplicity: ${roleId}`)
    remaining.set(roleId, available - 1)
  }

  return assignments
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Helpers ────────────────────────────────────────────────────
function sortedPlayers(room) {
  return (stateOf(room).seatOrder ?? []).map(id => room.players.get(id)).filter(Boolean)
}

function roleState(room, playerId) { return stateOf(room).players?.[playerId] ?? null }
function alivePlayers(room)  { return sortedPlayers(room).filter(p => roleState(room, p.id)?.alive) }
function deadPlayers(room)   { return sortedPlayers(room).filter(p => !roleState(room, p.id)?.alive) }

function killPlayer(room, playerId, reason) {
  const rs = roleState(room, playerId)
  if (rs) { rs.alive = false; rs.eliminationReason = reason }
}

function majorityTarget(votes) {
  const tally = new Map()
  for (const id of Object.values(votes)) {
    if (!id || String(id).startsWith('__')) continue
    tally.set(id, (tally.get(id) || 0) + 1)
  }
  if (!tally.size) return null
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1])
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return null
  return ranked[0][0]
}

function livingWerewolves(room) {
  return alivePlayers(room).filter(p => roleState(room, p.id)?.role === 'werewolf')
}

function acknowledgedCount(room) {
  return Object.values(stateOf(room).players || {}).filter(p => p.roleAcknowledged).length
}

function discussionSpeakerIds(room) {
  const state = stateOf(room)
  if (state.phase === 'discussion-r1') return alivePlayers(room).map(player => player.id)
  if (state.phase === 'discussion-r2') {
    const optIns = state.day?.r2OptIns ?? []
    return optIns.filter(id => roleState(room, id)?.alive)
  }
  return []
}

function nextDiscussionSpeaker(room) {
  const state = stateOf(room)
  const speakers = discussionSpeakerIds(room)
  const index = state.day?.speakerIndex ?? 0
  if (index + 1 < speakers.length) {
    state.day.speakerIndex = index + 1
    state.phaseStartedAt = Date.now()
    return true
  }
  return false
}

// ── Fate cards ─────────────────────────────────────────────────
const fateTendencies = {
  omen:    { id: 'omen',    label: '神谕', title: '投出神谕' },
  shelter: { id: 'shelter', label: '守护', title: '投出守护' },
  chaos:   { id: 'chaos',   label: '混乱', title: '投出混乱' },
  dark:    { id: 'dark',    label: '黑暗', title: '投出黑暗' },
}

function fateTriggers(room) {
  const state = stateOf(room)
  state.fateMeta ||= { peacefulNightStreak: 0, consumedTriggers: {} }
  state.fateMeta.consumedTriggers ||= {}
  const consumed = state.fateMeta.consumedTriggers
  const triggers = []
  if (!consumed['first-wolf-death'] && Object.values(state.players).some(player => player.role === 'werewolf' && !player.alive)) {
    triggers.push('first-wolf-death')
  }
  state.fateMeta.peacefulNightStreak = (state.nightDeaths?.length ?? 0) === 0
    ? state.fateMeta.peacefulNightStreak + 1
    : 0
  if (!consumed['two-peaceful-nights'] && state.fateMeta.peacefulNightStreak === 2) triggers.push('two-peaceful-nights')
  if (!consumed.endgame && alivePlayers(room).length <= 4) triggers.push('endgame')
  return triggers
}

function drawFateCard(room, { closedReason = 'all-voted', abstentionCount = 0 } = {}) {
  const state = stateOf(room)
  const triggers = fateTriggers(room)
  const card = selectFateCard({ votes: state.fateCouncil?.votes ?? {}, triggers })
  for (const trigger of triggers) state.fateMeta.consumedTriggers[trigger] = true
  // Placeholder cards deliberately resolve without mutating players, votes, or victory.
  state.currentFateCard = card
  state.fateHistory = state.fateHistory ?? []
  state.fateHistory.push({
    round: state.round,
    cardId: card.id,
    arcanaType: card.arcanaType,
    tendency: card.tendency,
    processed: true,
    processedAt: Date.now(),
    effectKey: card.effectKey,
    closedReason,
    abstentionCount,
  })
}

function refreshOracleWhisper(room) {
  const state = stateOf(room)
  const nonOracle = alivePlayers(room).filter(p => roleState(room, p.id)?.role !== 'oracle')
  if (!nonOracle.length) { state.oracle.current = null; return }
  const pick = nonOracle[Math.floor(Math.random() * nonOracle.length)]
  state.oracle.current = { playerId: pick.id, nickname: pick.nickname, team: roleState(room, pick.id)?.team ?? 'unknown' }
}

// ── Victory check ──────────────────────────────────────────────
function checkVictory(room) {
  const state = stateOf(room)
  return resolveVictory({ players: state.players, lovers: state.lovers, arsonist: state.arsonist }, thirdPartyVictoryHooks())
}

// ── Lover chain death ─────────────────────────────────────────
// Returns id of the player who died from heartbreak, or null.
function triggerLoverChain(room) {
  const state = stateOf(room)
  const lovers = state.lovers ?? []
  if (lovers.length !== 2) return null
  const [id1, id2] = lovers
  const r1 = roleState(room, id1)
  const r2 = roleState(room, id2)
  if (!r1 || !r2) return null
  if (!r1.alive && r2.alive) { killPlayer(room, id2, 'heartbreak'); return id2 }
  if (!r2.alive && r1.alive) { killPlayer(room, id1, 'heartbreak'); return id1 }
  return null
}

function resolveLoverChainSnapshot(state, players) {
  const [firstId, secondId] = state.lovers ?? []
  if (!firstId || !secondId) return []
  const first = players[firstId]
  const second = players[secondId]
  if (!first || !second) return []
  if (!first.alive && second.alive) {
    second.alive = false
    second.eliminationReason = 'heartbreak'
    return [{ playerId: secondId, reason: 'heartbreak' }]
  }
  if (!second.alive && first.alive) {
    first.alive = false
    first.eliminationReason = 'heartbreak'
    return [{ playerId: firstId, reason: 'heartbreak' }]
  }
  return []
}

// ── Night resolution ───────────────────────────────────────────
function resolveNight(room) {
  const state = stateOf(room)
  const outcome = resolveNightOutcome({ players: state.players, night: state.night, lovers: state.lovers }, {
    resolveLoverChain: players => resolveLoverChainSnapshot(state, players),
  })
  state.players = outcome.players
  state.nightDeaths = outcome.deaths.map(death => death.playerId)
  state.nightHistory ??= []
  state.nightHistory.push({ round: state.round ?? 1, deaths: [...state.nightDeaths] })
  state.night = outcome.nextNight
  state.pendingHunterRevenge = outcome.pendingHunterRevenge
}

// ── Voting resolution ──────────────────────────────────────────
function resolveVoting(room) {
  const state = stateOf(room)
  const votes = state.day?.votes ?? {}
  const tally = new Map()
  for (const id of Object.values(votes)) if (id) tally.set(id, (tally.get(id) || 0) + 1)
  state.day.votes = {}
  if (!tally.size) return { targetId: null, tied: false, candidates: [] }
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1])
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) {
    const top = ranked[0][1]
    return { targetId: null, tied: true, candidates: ranked.filter(([,c]) => c === top).map(([id]) => id) }
  }
  return { targetId: ranked[0][0], tied: false, candidates: [] }
}

function resolvePkVoting(room) {
  const target = majorityTarget(stateOf(room).day?.pkVotes ?? {})
  return { targetId: target, tied: !target }
}

function nightDeathsMessage(room) {
  const deaths = stateOf(room).nightDeaths ?? []
  if (!deaths.length) return '昨夜平安无事，没有人离开这个世界。'
  return `昨夜，${deaths.map(id => room.players.get(id)?.nickname ?? id).join('、')}离开了这个世界。`
}

// ── Create state ───────────────────────────────────────────────
export async function createWerewolfState(room) {
  const players = [...room.players.values()].sort((a, b) => a.joinedAt - b.joinedAt)
  const count = players.length
  const baseDeck = getCoreRoleDeck(count)
  const assignments = validateRoleAssignments(room, baseDeck)
  const pool = shuffle([...baseDeck])
  // Remove pre-assigned roles from the pool
  for (const roleId of Object.values(assignments)) {
    const idx = pool.indexOf(roleId)
    if (idx >= 0) pool.splice(idx, 1)
  }
  let poolIndex = 0

  room.gameState = {
    phase: 'role-assignment',
    nightStep: null,
    round: 1,
    phaseStartedAt: Date.now(),
    players: Object.fromEntries(players.map((player) => {
      const role = assignments[player.id] || pool[poolIndex++] || 'villager'
      const base = { role, team: getRole(role).team, alive: true, roleAcknowledged: false, eliminationReason: null }
      if (role === 'fateweaver') base.fateWeaverCards = { kill: true, save: true, guard: true }
      return [player.id, base]
    })),
    seatOrder: players.map(p => p.id),
    night: { targets: {}, guardianTarget: null, lastGuardianTarget: null, fateweaverKill: null, fateweaverGuard: null, fateweaverCardSubmission: null },
    day: { votes: {}, pkCandidates: [], pkVotes: {}, speakerIndex: 0, r2OptIns: [] },
    fateCouncil: { votes: {} },
    fateMeta: { peacefulNightStreak: 0, consumedTriggers: {} },
    fateHistory: [],
    nightHistory: [],
    voteHistory: [],
    executionHistory: [],
    currentFateCard: null,
    oracle: { current: null },
    lovers: [],
    arsonist: { marked: [] },
    pendingHunterRevenge: null,
    nightDeaths: [],
    executedPlayerId: null,
    lastOutcome: '角色已分配，命运的帷幕即将拉开。',
    victory: null,
  }
}

// ── Public state ───────────────────────────────────────────────
export function publicWerewolfState(room) {
  const state = stateOf(room)
  if (!state) return null
  const isDaytime = phaseTheme(state.phase) === 'day'
  const sorted = sortedPlayers(room)
  const speakerIndex = state.day?.speakerIndex ?? 0
  const speakerIds = discussionSpeakerIds(room)
  const speakerId = speakerIds[speakerIndex] ?? null
  const isDiscussion = state.phase === 'discussion-r1' || state.phase === 'discussion-r2'
  const pkEligibleVoters = alivePlayers(room).filter(player => !(state.day?.pkCandidates ?? []).includes(player.id))

  return {
    phase: state.phase,
    nightStep: state.nightStep,
    timeOfDay: isDaytime ? 'day' : 'night',
    round: state.round ?? 1,
    seats: sorted.map((player, idx) => ({
      id: player.id, nickname: player.nickname,
      alive: Boolean(roleState(room, player.id)?.alive),
      seatNumber: idx + 1,
      isSpeaking: isDiscussion && speakerId === player.id,
      isActiveStep: false,
    })),
    nightDeaths: isDaytime ? (state.nightDeaths ?? []) : [],
    speakerNickname: speakerId ? (room.players.get(speakerId)?.nickname ?? null) : null,
    fateCard: isDaytime ? (state.currentFateCard ?? null) : null,
    fateHistory: (state.fateHistory ?? []).map(({ round, cardId, arcanaType, tendency, processed, processedAt, effectKey }) =>
      ({ round, cardId, arcanaType, tendency, processed: Boolean(processed), processedAt, effectKey })),
    nightHistory: (state.nightHistory ?? []).map(({ round, deaths }) => ({ round, deaths: [...(deaths ?? [])] })),
    voteHistory: (state.voteHistory ?? []).map(({ round, kind, cast, expected, outcome }) => ({ round, kind, cast, expected, outcome: outcome ?? null })),
    executionHistory: (state.executionHistory ?? []).map(({ round, playerId }) => ({ round, playerId: playerId ?? null })),
    voteProgress: state.phase === 'voting'
      ? { cast: Object.keys(state.day?.votes ?? {}).length, expected: alivePlayers(room).length }
      : state.phase === 'pk-voting'
        ? { cast: Object.keys(state.day?.pkVotes ?? {}).length, expected: pkEligibleVoters.length }
        : null,
    pkCandidates: state.day?.pkCandidates ?? [],
    executedPlayerId: state.executedPlayerId ?? null,
    victory: state.victory ?? null,
    headline: state.victory?.title ?? '',
    directorMessage: state.lastOutcome ?? '',
    deadVoteCount: Object.keys(state.fateCouncil?.votes ?? {}).length,
    expectedDeadVoteCount: deadPlayers(room).length,
    acknowledgedCount: acknowledgedCount(room),
    expectedAcknowledgedCount: alivePlayers(room).length,
  }
}

// ── Private state ──────────────────────────────────────────────
export function privateWerewolfState(room, playerId) {
  const state = stateOf(room)
  const player = room.players.get(playerId)
  if (!state || !player) return null
  const secret = roleState(room, playerId)
  if (!secret) return null

  const roleDef = getRole(secret.role)
  const isDeadNightObserver = !secret.alive && state.phase === 'night'
  const wolfAllies = secret.role === 'werewolf' && !isDeadNightObserver
    ? alivePlayers(room).filter(p => p.id !== playerId && roleState(room, p.id)?.role === 'werewolf').map(p => ({ id: p.id, nickname: p.nickname }))
    : []
  const oracleMsg = secret.role === 'oracle' && !isDeadNightObserver && state.oracle?.current
    ? `神谕提示：玩家 ${state.oracle.current.nickname} 属于${state.oracle.current.team === 'wolf' ? '狼人' : '月光'}阵营。`
    : null

  const ns = state.nightStep
  let action = null

  if (state.phase === 'role-assignment' && secret.alive) {
    action = { type: 'confirm-role', label: secret.roleAcknowledged ? '已确认角色' : '我已查看我的角色', disabled: secret.roleAcknowledged }
  } else if (state.phase === 'night' && ns === 'cupid-action' && secret.alive && secret.role === 'cupid') {
    action = { type: 'multi-target', actionId: 'cupid-bind', label: '选择两名玩家成为恋人（可以选择自己）', requiredTargetCount: 2,
      targets: alivePlayers(room).map(p => ({ id: p.id, nickname: p.nickname })),
      selectedTargetIds: state.night?.cupidTargets ?? [] }
  } else if (state.phase === 'night' && ns === 'guardian-action' && secret.alive && secret.role === 'guardian') {
    action = { type: 'select-target', actionId: 'guardian-protect', label: '选择今晚守护的玩家', selectedTargetId: state.night?.guardianTarget || '',
      targets: alivePlayers(room).filter(p => p.id !== state.night?.lastGuardianTarget).map(p => ({ id: p.id, nickname: p.nickname })) }
  } else if (state.phase === 'night' && ns === 'wolf-action' && secret.alive && secret.role === 'werewolf') {
    action = { type: 'wolf-night-action', label: '选择今晚的行动', selectedTargetId: state.night?.targets?.[playerId] || '',
      targets: alivePlayers(room).filter(p => roleState(room, p.id)?.role !== 'werewolf').map(p => ({ id: p.id, nickname: p.nickname })),
      wolfOptions: [{ id: 'kill', label: '击杀目标' }, { id: 'no-action', label: '今晚不行动' }, { id: 'sacrifice', label: '自我牺牲' }] }
  } else if (state.phase === 'night' && ns === 'fate-weaver-action' && secret.alive && secret.role === 'fateweaver') {
    const wolfTarget = majorityTarget(state.night?.targets ?? {})
    const wolfTargetName = wolfTarget && !wolfTarget.startsWith('__') ? (room.players.get(wolfTarget)?.nickname ?? wolfTarget) : null
    const cards = secret.fateWeaverCards ?? {}
    const availableCards = [
      cards.kill  ? { id: 'kill',  label: '杀人牌（指定目标，无视守护）', requiresTarget: true  } : null,
      cards.save  ? { id: 'save',  label: '救人牌（解除今夜袭击）',       requiresTarget: false } : null,
      cards.guard ? { id: 'guard', label: '守护牌（保护指定玩家）',       requiresTarget: true  } : null,
      { id: 'skip', label: '本夜不使用', requiresTarget: false },
    ].filter(Boolean)
    const submitted = state.night?.fateweaverCardSubmission
    action = { type: 'card-and-target', actionId: 'fate-weaver-card',
      label: wolfTargetName ? `${wolfTargetName}遭受袭击` : '今晚无人遭受袭击',
      wolfTargetName, cards: availableCards,
      targets: alivePlayers(room).map(p => ({ id: p.id, nickname: p.nickname })),
      selectedCardId: submitted?.cardId,
      selectedTargetId: submitted?.targetId,
      disabled: Boolean(submitted) }
  } else if (state.phase === 'night' && ns === 'oracle-action' && secret.alive && secret.role === 'oracle') {
    action = { type: 'oracle-confirm', label: '我已收到神谕' }
  } else if (state.phase === 'night' && ns === 'arsonist-mark' && secret.alive && secret.role === 'arsonist') {
    const marked = state.arsonist?.marked ?? []
    action = { type: 'select-target', actionId: 'arsonist-mark',
      label: `选择今晚标记的目标（已标记 ${marked.length} 人）`,
      targets: alivePlayers(room).filter(p => p.id !== playerId).map(p => ({ id: p.id, nickname: p.nickname, marked: marked.includes(p.id) })),
      markedCount: marked.length }
  } else if (state.phase === 'hunter-revenge' && playerId === state.pendingHunterRevenge?.hunterId) {
    action = { type: 'select-target', actionId: 'hunter-revenge', label: '你已死亡，选择带走一名玩家殉葬（可跳过）',
      targets: alivePlayers(room).map(p => ({ id: p.id, nickname: p.nickname })),
      allowSkip: true }
  } else if (state.phase === 'voting' && secret.alive) {
    action = { type: 'select-target', actionId: 'vote-target', label: '投票放逐', selectedTargetId: state.day?.votes?.[playerId] || '',
      targets: alivePlayers(room).filter(p => p.id !== playerId).map(p => ({ id: p.id, nickname: p.nickname })) }
  } else if (state.phase === 'pk-voting' && secret.alive && !(state.day?.pkCandidates ?? []).includes(playerId)) {
    action = { type: 'select-target', actionId: 'pk-vote', label: 'PK投票', selectedTargetId: state.day?.pkVotes?.[playerId] || '',
      targets: (state.day?.pkCandidates ?? []).map(id => ({ id, nickname: room.players.get(id)?.nickname ?? id })) }
  } else if (!secret.alive && state.phase === 'fate-council') {
    action = { type: 'fate-vote', label: '投出命运选择', selectedTendency: state.fateCouncil?.votes?.[playerId] || '',
      tendencies: Object.values(fateTendencies) }
  } else if (state.phase === 'discussion-r2' && secret.alive) {
    action = { type: 'discussion-opt-in', label: (state.day?.r2OptIns ?? []).includes(playerId) ? '已报名第二轮发言' : '报名第二轮发言', selected: (state.day?.r2OptIns ?? []).includes(playerId), disabled: (state.day?.r2OptIns ?? []).includes(playerId) }
  }

  // Lover info: show partner identity to each lover
  const lovers = state.lovers ?? []
  const loverInfo = lovers.includes(playerId) && lovers.length === 2
    ? (() => {
        const otherId = lovers.find(id => id !== playerId)
        const otherRs = roleState(room, otherId)
        const otherDef = getRole(otherRs?.role)
        return { partnerId: otherId, partnerNickname: room.players.get(otherId)?.nickname ?? '', partnerRole: otherDef.name }
      })()
    : null

  return { playerId, nickname: player.nickname, alive: Boolean(secret.alive), phase: state.phase, role: roleDef, team: secret.team, wolfAllies, oracleMessage: oracleMsg, loverInfo, privateBlessing: '', tarotCards: [], action, promptTitle: isDeadNightObserver ? '观察中' : '', promptBody: isDeadNightObserver ? '你正在观察夜晚，请保持沉默，勿向存活玩家传递信息。' : '' }
}

// ── Phase advance engine ───────────────────────────────────────
export async function advanceWerewolf(room, { forceFateCouncil = false } = {}) {
  const state = stateOf(room)
  if (!state) return

  if (state.phase === 'role-assignment') {
    state.nightDeaths = []; state.executedPlayerId = null
    state.day = { votes: {}, pkCandidates: [], pkVotes: {}, speakerIndex: 0, r2OptIns: [] }
    refreshOracleWhisper(room)
    setPhase(room, 'night')
    state.nightStep = firstNightStep(room)
    state.lastOutcome = '夜幕降临，村庄陷入沉睡。'
    return
  }

  if (state.phase === 'night') {
    const next = nextNightStep(room)
    if (next) {
      state.nightStep = next; state.phaseStartedAt = Date.now()
    } else {
      resolveNight(room)
      const victory = checkVictory(room)
      if (victory) { state.victory = victory; setPhase(room, 'complete'); state.nightStep = null; return }
      // Hunter revenge before fate-council
      if (state.pendingHunterRevenge) {
        state.pendingHunterRevenge.nextPhase = 'fate-council'
        setPhase(room, 'hunter-revenge'); state.nightStep = null
        state.lastOutcome = '夜晚结算后，猎人发动了陪葬。'
        return
      }
      state.currentFateCard = null
      setPhase(room, 'fate-council'); state.nightStep = null
      state.lastOutcome = '夜晚的秘密已经落定，命运议会开始。'
    }
    return
  }

  if (state.phase === 'hunter-revenge') {
    const nextPhase = state.pendingHunterRevenge?.nextPhase ?? 'fate-council'
    state.pendingHunterRevenge = null
    if (nextPhase === 'fate-council') {
      state.currentFateCard = null
      setPhase(room, 'fate-council')
      state.lastOutcome = '命运议会开始。'
    } else {
      const v = checkVictory(room)
      if (v) { state.victory = v; state.lastOutcome = `${v.winner}获得了最终的胜利！` }
      setPhase(room, 'victory-check')
    }
    return
  }

  if (state.phase === 'fate-council') {
    const eligible = deadPlayers(room)
    const votedCount = eligible.filter(player => state.fateCouncil?.votes?.[player.id]).length
    const allVoted = votedCount === eligible.length
    if (!allVoted && !forceFateCouncil) return { advanced: false, reason: 'awaiting-fate-votes' }
    drawFateCard(room, {
      closedReason: allVoted ? 'all-voted' : 'host-close',
      abstentionCount: eligible.length - votedCount,
    })
    refreshOracleWhisper(room)
    setPhase(room, 'fate-card-reveal')
    state.lastOutcome = `命运翻开了：${state.currentFateCard.title}`
    return { advanced: true }
  }
  if (state.phase === 'fate-card-reveal') { setPhase(room, 'fate-blessing'); state.lastOutcome = '命运眷顾了一位玩家。'; return }
  if (state.phase === 'fate-blessing') { setPhase(room, 'night-results'); state.lastOutcome = nightDeathsMessage(room); return }
  if (state.phase === 'night-results') { setPhase(room, 'discussion-r1'); state.day.speakerIndex = 0; state.lastOutcome = '请玩家依次发言。'; return }
  if (state.phase === 'discussion-r1') {
    if (nextDiscussionSpeaker(room)) { state.lastOutcome = '请下一位玩家发言。'; return }
    setPhase(room, 'discussion-r2'); state.day.r2OptIns = []; state.day.speakerIndex = 0; state.lastOutcome = '进入第二轮自愿发言。'; return
  }
  if (state.phase === 'discussion-r2') {
    if (nextDiscussionSpeaker(room)) { state.lastOutcome = '请下一位报名玩家发言。'; return }
    state.day.votes = {}; setPhase(room, 'voting'); state.lastOutcome = '发言结束，投票开始。'; return
  }

  if (state.phase === 'voting') {
    const cast = Object.keys(state.day?.votes ?? {}).length
    const expected = alivePlayers(room).length
    const result = resolveVoting(room)
    state.voteHistory ??= []
    state.voteHistory.push({ round: state.round ?? 1, kind: 'vote', cast, expected, outcome: result.targetId ?? null })
    if (result.tied) {
      state.day.pkCandidates = result.candidates; state.day.pkVotes = {}
      setPhase(room, 'pk-discussion'); state.lastOutcome = '出现平票，进入PK环节。'
    } else {
      state.executedPlayerId = result.targetId ?? null
      state.executionHistory ??= []
      state.executionHistory.push({ round: state.round ?? 1, playerId: result.targetId ?? null })
      if (result.targetId) {
        killPlayer(room, result.targetId, 'vote')
        const heartbreak = triggerLoverChain(room)
        const rs = roleState(room, result.targetId)
        if (rs?.role === 'hunter' && !state.pendingHunterRevenge) {
          state.pendingHunterRevenge = { hunterId: result.targetId, nextPhase: 'victory-check' }
        } else if (heartbreak) {
          const hbRs = roleState(room, heartbreak)
          if (hbRs?.role === 'hunter' && hbRs?.eliminationReason !== 'fateweaver-kill' && !state.pendingHunterRevenge) {
            state.pendingHunterRevenge = { hunterId: heartbreak, nextPhase: 'victory-check' }
          }
        }
      }
      setPhase(room, 'execution')
      state.lastOutcome = result.targetId ? `${room.players.get(result.targetId)?.nickname ?? result.targetId}被放逐了。` : '投票无效，今日无人被放逐。'
    }
    return
  }

  if (state.phase === 'pk-discussion') { state.day.pkVotes = {}; setPhase(room, 'pk-voting'); state.lastOutcome = '请非PK玩家投票。'; return }

  if (state.phase === 'pk-voting') {
    const cast = Object.keys(state.day?.pkVotes ?? {}).length
    const expected = alivePlayers(room).filter(player => !(state.day?.pkCandidates ?? []).includes(player.id)).length
    const pk = resolvePkVoting(room)
    state.voteHistory ??= []
    state.voteHistory.push({ round: state.round ?? 1, kind: 'pk', cast, expected, outcome: pk.targetId ?? null })
    state.executedPlayerId = pk.targetId ?? null
    state.executionHistory ??= []
    state.executionHistory.push({ round: state.round ?? 1, playerId: pk.targetId ?? null })
    if (pk.targetId) {
      killPlayer(room, pk.targetId, 'pk-vote')
      const heartbreak = triggerLoverChain(room)
      const rs = roleState(room, pk.targetId)
      if (rs?.role === 'hunter' && !state.pendingHunterRevenge) {
        state.pendingHunterRevenge = { hunterId: pk.targetId, nextPhase: 'victory-check' }
      } else if (heartbreak) {
        const hbRs = roleState(room, heartbreak)
        if (hbRs?.role === 'hunter' && hbRs?.eliminationReason !== 'fateweaver-kill' && !state.pendingHunterRevenge) {
          state.pendingHunterRevenge = { hunterId: heartbreak, nextPhase: 'victory-check' }
        }
      }
    }
    setPhase(room, 'execution')
    state.lastOutcome = pk.targetId ? `${room.players.get(pk.targetId)?.nickname ?? pk.targetId}在PK中被放逐。` : 'PK平票，今日无人被放逐。'
    return
  }

  if (state.phase === 'execution') {
    if (state.pendingHunterRevenge) {
      state.pendingHunterRevenge.nextPhase = 'victory-check'
      setPhase(room, 'hunter-revenge')
      state.lastOutcome = '被放逐的猎人发动了陪葬。'
      return
    }
    const v = checkVictory(room)
    if (v) { state.victory = v; state.lastOutcome = `${v.winner}获得了最终的胜利！` }
    setPhase(room, 'victory-check')
    return
  }

  if (state.phase === 'victory-check') {
    if (state.victory) { setPhase(room, 'complete') }
    else {
      state.round = (state.round ?? 1) + 1
      state.nightDeaths = []; state.executedPlayerId = null; state.currentFateCard = null
      state.night = { targets: {}, guardianTarget: null, lastGuardianTarget: state.night?.lastGuardianTarget ?? null, fateweaverKill: null, fateweaverGuard: null, fateweaverCardSubmission: null }
      state.day = { votes: {}, pkCandidates: [], pkVotes: {}, speakerIndex: 0, r2OptIns: [] }
      state.fateCouncil = { votes: {} }
      refreshOracleWhisper(room); setPhase(room, 'night'); state.nightStep = firstNightStep(room)
      state.lastOutcome = '夜幕再次降临。'
    }
    return
  }
}

// ── Action handler ─────────────────────────────────────────────
export function actionWerewolf(room, playerId, payload) {
  const state = stateOf(room)
  if (!state) return { status: 409, error: 'Game not started' }
  const player = room.players.get(playerId)
  const secret = roleState(room, playerId)
  if (!player || !secret) return { status: 404, error: 'Player not found' }

  const { type, targetId } = payload

  if (type === 'confirm-role') {
    if (state.phase !== 'role-assignment') return { status: 409, error: 'Wrong phase' }
    secret.roleAcknowledged = true
    return { status: 200, allSubmitted: Object.values(state.players).every(p => p.roleAcknowledged), private: privateWerewolfState(room, playerId) }
  }
  if (type === 'cupid-bind') {
    if (state.phase !== 'night' || state.nightStep !== 'cupid-action') return { status: 409, error: 'Wrong phase/step' }
    if (!secret.alive || secret.role !== 'cupid') return { status: 403, error: 'Only living cupid' }
    const tids = payload.targetIds
    if (!Array.isArray(tids) || tids.length !== 2 || tids[0] === tids[1]) return { status: 400, error: 'Must select 2 different players' }
    for (const id of tids) if (!roleState(room, id)?.alive) return { status: 400, error: 'Targets must be alive' }
    state.lovers = tids
    return { status: 200, allSubmitted: true, private: privateWerewolfState(room, playerId) }
  }
  if (type === 'guardian-protect') {
    if (state.phase !== 'night' || state.nightStep !== 'guardian-action') return { status: 409, error: 'Wrong phase/step' }
    if (!secret.alive || secret.role !== 'guardian') return { status: 403, error: 'Only living guardian' }
    if (targetId === state.night?.lastGuardianTarget) return { status: 400, error: 'Cannot protect same player twice' }
    if (!roleState(room, targetId)?.alive) return { status: 400, error: 'Target must be alive' }
    state.night.guardianTarget = targetId
    return { status: 200, allSubmitted: true, private: privateWerewolfState(room, playerId) }
  }
  if (type === 'wolf-night-action') {
    if (state.phase !== 'night' || state.nightStep !== 'wolf-action') return { status: 409, error: 'Wrong phase/step' }
    if (!secret.alive || secret.role !== 'werewolf') return { status: 403, error: 'Only living wolves' }
    const option = String(payload.option || 'kill')
    if (option === 'no-action') state.night.targets[playerId] = '__no_action__'
    else if (option === 'sacrifice') state.night.targets[playerId] = '__sacrifice__'
    else {
      if (!targetId || !roleState(room, targetId)?.alive || roleState(room, targetId)?.role === 'werewolf') return { status: 400, error: 'Invalid target' }
      state.night.targets[playerId] = targetId
    }
    return { status: 200, allSubmitted: livingWerewolves(room).every(p => state.night.targets[p.id]), private: privateWerewolfState(room, playerId) }
  }
  if (type === 'fate-weaver-card') {
    if (state.phase !== 'night' || state.nightStep !== 'fate-weaver-action') return { status: 409, error: 'Wrong phase/step' }
    if (!secret.alive || secret.role !== 'fateweaver') return { status: 403, error: 'Only living fateweaver' }
    const priorSubmission = state.night?.fateweaverCardSubmission
    if (priorSubmission) {
      const sameSubmission = priorSubmission.cardId === payload.cardId
        && priorSubmission.targetId === (targetId || null)
      if (sameSubmission) return { status: 200, allSubmitted: true, private: privateWerewolfState(room, playerId) }
      return { status: 409, error: 'Fate weaver action already submitted' }
    }
    const cardId = String(payload.cardId)
    const cards = secret.fateWeaverCards ?? {}
    if (cardId === 'kill') {
      if (!cards.kill) return { status: 400, error: 'Kill card already used' }
      if (!targetId || !roleState(room, targetId)?.alive) return { status: 400, error: 'Invalid kill target' }
      state.night.fateweaverKill = targetId
      secret.fateWeaverCards.kill = false
    } else if (cardId === 'save') {
      if (!cards.save) return { status: 400, error: 'Save card already used' }
      const wt = majorityTarget(state.night?.targets ?? {})
      if (wt && !wt.startsWith('__')) {
        for (const [wolfId, choice] of Object.entries(state.night.targets ?? {})) {
          if (choice === wt) state.night.targets[wolfId] = '__no_action__'
        }
      }
      secret.fateWeaverCards.save = false
    } else if (cardId === 'guard') {
      if (!cards.guard) return { status: 400, error: 'Guard card already used' }
      if (!targetId || !roleState(room, targetId)?.alive) return { status: 400, error: 'Invalid guard target' }
      state.night.fateweaverGuard = targetId
      secret.fateWeaverCards.guard = false
    } else if (cardId !== 'skip') return { status: 400, error: 'Invalid fate weaver card' }
    state.night.fateweaverCardSubmission = { cardId, targetId: targetId || null }
    return { status: 200, allSubmitted: true, private: privateWerewolfState(room, playerId) }
  }
  if (type === 'oracle-confirm') {
    if (state.phase !== 'night' || state.nightStep !== 'oracle-action') return { status: 409, error: 'Wrong phase/step' }
    if (!secret.alive || secret.role !== 'oracle') return { status: 403, error: 'Only the living oracle can confirm' }
    return { status: 200, allSubmitted: true, private: privateWerewolfState(room, playerId) }
  }
  if (type === 'vote-target') {
    if (state.phase !== 'voting') return { status: 409, error: 'Not voting phase' }
    if (!secret.alive) return { status: 403, error: 'Dead players cannot vote' }
    if (!roleState(room, targetId)?.alive || targetId === playerId) return { status: 400, error: 'Invalid target' }
    state.day.votes[playerId] = targetId
    return { status: 200, allSubmitted: alivePlayers(room).every(p => state.day.votes[p.id]), private: privateWerewolfState(room, playerId) }
  }
  if (type === 'pk-vote') {
    if (state.phase !== 'pk-voting') return { status: 409, error: 'Not pk-voting phase' }
    if (!secret.alive) return { status: 403, error: 'Dead players cannot vote' }
    if ((state.day?.pkCandidates ?? []).includes(playerId)) return { status: 403, error: 'Candidates cannot vote' }
    if (!(state.day?.pkCandidates ?? []).includes(targetId)) return { status: 400, error: 'Must vote for a candidate' }
    state.day.pkVotes[playerId] = targetId
    const eligible = alivePlayers(room).filter(p => !(state.day.pkCandidates ?? []).includes(p.id))
    return { status: 200, allSubmitted: eligible.every(p => state.day.pkVotes[p.id]), private: privateWerewolfState(room, playerId) }
  }
  if (type === 'discussion-opt-in') {
    if (state.phase !== 'discussion-r2') return { status: 409, error: 'Not discussion round two' }
    if (!secret.alive) return { status: 403, error: 'Dead players cannot opt in' }
    state.day.r2OptIns ||= []
    if (!state.day.r2OptIns.includes(playerId)) state.day.r2OptIns.push(playerId)
    return { status: 200, allSubmitted: false, private: privateWerewolfState(room, playerId) }
  }
  if (type === 'arsonist-mark') {
    if (state.phase !== 'night' || state.nightStep !== 'arsonist-mark') return { status: 409, error: 'Wrong phase/step' }
    if (!secret.alive || secret.role !== 'arsonist') return { status: 403, error: 'Only living arsonist' }
    if (!targetId || !roleState(room, targetId)?.alive) return { status: 400, error: 'Target must be alive' }
    state.arsonist = state.arsonist ?? { marked: [] }
    if (!state.arsonist.marked.includes(targetId)) state.arsonist.marked.push(targetId)
    return { status: 200, allSubmitted: true, private: privateWerewolfState(room, playerId) }
  }
  if (type === 'hunter-revenge') {
    if (state.phase !== 'hunter-revenge') return { status: 409, error: 'Wrong phase' }
    if (playerId !== state.pendingHunterRevenge?.hunterId) return { status: 403, error: 'Only the hunter' }
    if (targetId) {
      if (!roleState(room, targetId)?.alive) return { status: 400, error: 'Target must be alive' }
      killPlayer(room, targetId, 'hunter-revenge')
      triggerLoverChain(room)
    }
    return { status: 200, allSubmitted: true, private: privateWerewolfState(room, playerId) }
  }
  if (type === 'fate-vote') {
    if (state.phase !== 'fate-council') return { status: 409, error: 'Not fate-council phase' }
    if (secret.alive) return { status: 403, error: 'Only dead players vote' }
    if (!fateTendencies[payload.tendency]) return { status: 400, error: 'Invalid tendency' }
    state.fateCouncil.votes[playerId] = payload.tendency
    return { status: 200, allSubmitted: deadPlayers(room).every(p => state.fateCouncil.votes[p.id]), private: privateWerewolfState(room, playerId) }
  }
  return { status: 400, error: `Unknown action: ${type}` }
}

// ── Test helper: auto-fill default actions for current phase ─────────────────
// Used by /werewolf/test/auto endpoint. Mutates state directly (no HTTP round-trip).
export function testAutoComplete(room) {
  const state = stateOf(room)
  if (!state) return

  const phase = state.phase
  const ns    = state.nightStep

  if (phase === 'role-assignment') {
    for (const p of alivePlayers(room)) {
      state.players[p.id].roleAcknowledged = true
    }
    return
  }

  if (phase === 'night') {
    if (ns === 'guardian-action') {
      const guardian = alivePlayers(room).find(p => roleState(room, p.id)?.role === 'guardian')
      if (guardian) {
        const target = alivePlayers(room).find(p => p.id !== guardian.id)
        if (target) state.night.guardianTarget = target.id
      }
      return
    }
    if (ns === 'wolf-action') {
      const wolves  = livingWerewolves(room)
      const target  = alivePlayers(room).find(p => roleState(room, p.id)?.role !== 'werewolf')
      for (const wolf of wolves) state.night.targets[wolf.id] = target?.id || '__no_action__'
      return
    }
    if (ns === 'fate-weaver-action') return  // skip = advance
    if (ns === 'oracle-action')      return  // auto-confirm
  }

  if (phase === 'fate-council') {
    for (const p of deadPlayers(room)) state.fateCouncil.votes[p.id] = 'chaos'
    return
  }

  if (phase === 'voting') {
    const alive = alivePlayers(room)
    for (let i = 0; i < alive.length; i++) {
      const target = alive[(i + 1) % alive.length]
      state.day.votes[alive[i].id] = target.id
    }
    return
  }

  if (phase === 'pk-voting') {
    const candidates = state.day?.pkCandidates ?? []
    const eligible   = alivePlayers(room).filter(p => !candidates.includes(p.id))
    const target     = candidates[0]
    if (target) for (const p of eligible) state.day.pkVotes[p.id] = target
    return
  }
  // discussion / night-results / etc. — no actions needed, just advance
}

export async function restartWerewolf(room) {
  await createWerewolfState(room)
}

const testerRoleOrder = ['werewolf', 'villager', 'guardian', 'oracle', 'fateweaver', 'hunter', 'cupid', 'arsonist']
export async function setWerewolfTesterRole(room, playerId, roleId) {
  room.fateWerewolfSetup ||= { roleAssignments: {} }
  room.fateWerewolfSetup.roleAssignments ||= {}
  if (!room.players.has(String(playerId))) return { status: 404, error: 'Player not found' }
  if (testerRoleOrder.includes(String(roleId))) {
    room.fateWerewolfSetup.roleAssignments[String(playerId)] = String(roleId)
  } else {
    delete room.fateWerewolfSetup.roleAssignments[String(playerId)]
  }
  return { status: 200 }
}

export const werewolfRuntime = {
  gameId: 'fate-werewolf',
  createState: createWerewolfState,
  publicState: publicWerewolfState,
  privateState: privateWerewolfState,
  advance: advanceWerewolf,
  action: actionWerewolf,
  restart: restartWerewolf,
  testerRole: setWerewolfTesterRole,
  testAutoComplete,
}
