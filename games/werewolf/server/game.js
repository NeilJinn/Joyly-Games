// ── Night step sequence ────────────────────────────────────────
// First night includes cupid (before guardian). Every night includes arsonist (after oracle).
const FIRST_NIGHT_STEPS = [
  { id: 'cupid-action',       requiredRole: 'cupid'      },
  { id: 'guardian-action',    requiredRole: 'guardian'   },
  { id: 'wolf-action',        requiredRole: 'werewolf'   },
  { id: 'fate-weaver-action', requiredRole: 'fateweaver' },
  { id: 'oracle-action',      requiredRole: 'oracle'     },
  { id: 'arsonist-mark',      requiredRole: 'arsonist'   },
]
const REGULAR_NIGHT_STEPS = [
  { id: 'guardian-action',    requiredRole: 'guardian'   },
  { id: 'wolf-action',        requiredRole: 'werewolf'   },
  { id: 'fate-weaver-action', requiredRole: 'fateweaver' },
  { id: 'oracle-action',      requiredRole: 'oracle'     },
  { id: 'arsonist-mark',      requiredRole: 'arsonist'   },
]

function stateOf(room) { return room.gameState }

function nightStepsForRoom(room) {
  const state = stateOf(room)
  const roles = new Set(Object.values(state.players || {}).map(p => p.role))
  const template = state.round === 1 ? FIRST_NIGHT_STEPS : REGULAR_NIGHT_STEPS
  return template.filter(s => roles.has(s.requiredRole)).map(s => s.id)
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

// ── Role definitions ───────────────────────────────────────────
const roleDefinitions = {
  werewolf:   { id: 'werewolf',   name: '狼人',       team: 'wolf',  cardTitle: '狼人',       summary: '夜间选择击杀目标',                       accent: '#c0392b' },
  guardian:   { id: 'guardian',   name: '守护者',     team: 'moon',  cardTitle: '守护者',     summary: '每夜守护一位玩家，不可连续守护',             accent: '#2980b9' },
  oracle:     { id: 'oracle',     name: '神谕者',     team: 'moon',  cardTitle: '神谕者',     summary: '每夜收到一条阵营神谕提示',                   accent: '#8e44ad' },
  fateweaver: { id: 'fateweaver', name: '命运编织者', team: 'moon',  cardTitle: '命运编织者', summary: '可用卡牌干预命运',                           accent: '#16a085' },
  hunter:     { id: 'hunter',     name: '猎人',       team: 'moon',  cardTitle: '猎人',       summary: '死亡时可带走一名玩家殉葬',                   accent: '#d35400' },
  cupid:      { id: 'cupid',      name: '丘比特',     team: 'third', cardTitle: '丘比特',     summary: '首夜指定两名恋人，恋人组成独立胜利条件',     accent: '#e91e8c' },
  arsonist:   { id: 'arsonist',   name: '焚焰者',     team: 'third', cardTitle: '焚焰者',     summary: '每夜标记一名玩家，标记所有存活玩家即胜利',   accent: '#e67e22' },
  villager:   { id: 'villager',   name: '村民',       team: 'moon',  cardTitle: '村民',       summary: '白天投票识破狼人',                           accent: '#7f8c8d' },
}

// Role deck per player count — derived from agreed configuration table
// Roles enter in this order as count grows:
//  5+  : oracle, fateweaver
//  7+  : hunter
//  8+  : 3rd wolf
//  11+ : guardian
//  12+ : 4th wolf
//  13+ : cupid
//  14+ : arsonist, 4th wolf stays (5th wolf from 15+, 6th from 18+)
const roleDecksByCount = {
  5:  ['werewolf',                                        'oracle', 'fateweaver',                                    'villager', 'villager'],
  6:  ['werewolf', 'werewolf',                            'oracle', 'fateweaver',                                    'villager', 'villager'],
  7:  ['werewolf', 'werewolf',                            'oracle', 'fateweaver', 'hunter',                          'villager', 'villager'],
  8:  ['werewolf', 'werewolf',                            'oracle', 'fateweaver', 'hunter',                          'villager', 'villager', 'villager'],
  9:  ['werewolf', 'werewolf', 'werewolf',                'oracle', 'fateweaver', 'hunter',                          'villager', 'villager', 'villager'],
  10: ['werewolf', 'werewolf', 'werewolf',                'oracle', 'fateweaver', 'hunter',                          'villager', 'villager', 'villager', 'villager'],
  11: ['werewolf', 'werewolf', 'werewolf',                'oracle', 'fateweaver', 'hunter', 'guardian',              'villager', 'villager', 'villager', 'villager'],
  12: ['werewolf', 'werewolf', 'werewolf', 'werewolf',    'oracle', 'fateweaver', 'hunter', 'guardian',              'villager', 'villager', 'villager', 'villager'],
  13: ['werewolf', 'werewolf', 'werewolf', 'werewolf',    'oracle', 'fateweaver', 'hunter', 'guardian', 'cupid',     'villager', 'villager', 'villager', 'villager'],
  14: ['werewolf', 'werewolf', 'werewolf', 'werewolf',    'oracle', 'fateweaver', 'hunter', 'guardian', 'cupid', 'arsonist', 'villager', 'villager', 'villager', 'villager'],
  15: ['werewolf', 'werewolf', 'werewolf', 'werewolf', 'werewolf', 'oracle', 'fateweaver', 'hunter', 'guardian', 'cupid', 'arsonist', 'villager', 'villager', 'villager', 'villager'],
  16: ['werewolf', 'werewolf', 'werewolf', 'werewolf', 'werewolf', 'oracle', 'fateweaver', 'hunter', 'guardian', 'cupid', 'arsonist', 'villager', 'villager', 'villager', 'villager', 'villager'],
  17: ['werewolf', 'werewolf', 'werewolf', 'werewolf', 'werewolf', 'oracle', 'fateweaver', 'hunter', 'guardian', 'cupid', 'arsonist', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager'],
  18: ['werewolf', 'werewolf', 'werewolf', 'werewolf', 'werewolf', 'werewolf', 'oracle', 'fateweaver', 'hunter', 'guardian', 'cupid', 'arsonist', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager'],
  19: ['werewolf', 'werewolf', 'werewolf', 'werewolf', 'werewolf', 'werewolf', 'oracle', 'fateweaver', 'hunter', 'guardian', 'cupid', 'arsonist', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager'],
  20: ['werewolf', 'werewolf', 'werewolf', 'werewolf', 'werewolf', 'werewolf', 'oracle', 'fateweaver', 'hunter', 'guardian', 'cupid', 'arsonist', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager'],
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

// ── Fate cards ─────────────────────────────────────────────────
const fateTendencies = {
  omen:    { id: 'omen',    label: '凶兆', title: '投出凶兆' },
  shelter: { id: 'shelter', label: '庇护', title: '投出庇护' },
  chaos:   { id: 'chaos',   label: '混沌', title: '投出混沌' },
  dark:    { id: 'dark',    label: '黑暗', title: '投出黑暗' },
}

const fateCards = [
  { id: 'fc-omen-1',    title: '审判之眼', text: '今日投票，得票最少的玩家免于放逐。',           tendency: 'omen',    tendencyLabel: '凶兆' },
  { id: 'fc-shelter-1', title: '庇护之盾', text: '本轮守护者可守护上一轮同一对象。',             tendency: 'shelter', tendencyLabel: '庇护' },
  { id: 'fc-chaos-1',   title: '命运逆转', text: '得票最多的两位玩家对换投票结果。',             tendency: 'chaos',   tendencyLabel: '混沌' },
  { id: 'fc-dark-1',    title: '黑暗契约', text: '本轮狼人可额外选择一个目标进行袭击。',         tendency: 'dark',    tendencyLabel: '黑暗' },
]

function drawFateCard(room) {
  const state = stateOf(room)
  const council = state.fateCouncil?.votes ?? {}
  const tally = new Map()
  for (const t of Object.values(council)) tally.set(t, (tally.get(t) || 0) + 1)
  const winner = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'chaos'
  const matching = fateCards.filter(c => c.tendency === winner)
  const pool = matching.length ? matching : fateCards
  state.currentFateCard = pool[Math.floor(Math.random() * pool.length)]
  state.fateHistory = state.fateHistory ?? []
  state.fateHistory.push(state.currentFateCard.id)
  state.fateCouncil.votes = {}
}

function refreshOracleWhisper(room) {
  const state = stateOf(room)
  const nonOracle = alivePlayers(room).filter(p => roleState(room, p.id)?.role !== 'oracle')
  if (!nonOracle.length) { state.oracle.current = null; return }
  const pick = nonOracle[Math.floor(Math.random() * nonOracle.length)]
  state.oracle.current = { playerId: pick.id, nickname: pick.nickname, team: roleState(room, pick.id)?.team ?? 'unknown' }
}

// ── Victory check — order: lovers → arsonist → wolves → village ──
function checkVictory(room) {
  const alive = alivePlayers(room)
  const state = stateOf(room)

  // 1. Lovers third-party: mixed-faction couple are the last two survivors
  const lovers = state.lovers ?? []
  if (lovers.length === 2 && alive.length === 2 && lovers.every(id => roleState(room, id)?.alive)) {
    const t1 = roleState(room, lovers[0])?.team
    const t2 = roleState(room, lovers[1])?.team
    if (t1 !== t2) return { winner: '恋人阵营', title: '恋人获胜！', body: '两位恋人成为了世界上最后的两人。' }
  }

  // 2. Arsonist: every other alive player is marked
  const arsonist = alive.find(p => roleState(room, p.id)?.role === 'arsonist')
  if (arsonist) {
    const marked = state.arsonist?.marked ?? []
    const others = alive.filter(p => p.id !== arsonist.id)
    if (others.length > 0 && others.every(p => marked.includes(p.id))) {
      return { winner: '焚焰者', title: '焚焰者获胜！', body: '所有玩家都已被标记，火焰即将燃起。' }
    }
  }

  // 3. Wolf victory: wolves ≥ moon-faction survivors
  const wolves   = alive.filter(p => roleState(room, p.id)?.role === 'werewolf')
  const moonTeam = alive.filter(p => roleState(room, p.id)?.team === 'moon')
  if (wolves.length === 0) return { winner: '村庄阵营', title: '村庄获胜！', body: '所有狼人已被放逐，村庄获得了最终的胜利。' }
  if (wolves.length >= moonTeam.length) return { winner: '狼人阵营', title: '狼人获胜！', body: '狼人数量已超过平民，黑夜笼罩了村庄。' }
  return null
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

// ── Night resolution ───────────────────────────────────────────
function resolveNight(room) {
  const state = stateOf(room)
  state.nightDeaths = []

  // Wolf self-sacrifice: each wolf who voted __sacrifice__ dies
  for (const [wolfId, vote] of Object.entries(state.night?.targets ?? {})) {
    if (vote === '__sacrifice__') {
      const rs = roleState(room, wolfId)
      if (rs?.alive) { killPlayer(room, wolfId, 'sacrifice'); state.nightDeaths.push(wolfId) }
    }
  }

  // Fateweaver kill card (bypasses guardian)
  const fkTarget = state.night.fateweaverKill
  if (fkTarget) {
    const fkVictim = roleState(room, fkTarget)
    if (fkVictim?.alive) { killPlayer(room, fkTarget, 'fateweaver-kill'); state.nightDeaths.push(fkTarget) }
    state.night.fateweaverKill = null
  }

  // Wolf kill (blocked by guardian or fateweaver guard)
  const targetId   = majorityTarget(state.night?.targets ?? {})
  const shielded   = [state.night?.guardianTarget, state.night?.fateweaverGuard].filter(Boolean)
  if (targetId && !shielded.includes(targetId)) {
    const victim = roleState(room, targetId)
    if (victim?.alive && victim.role !== 'werewolf') {
      killPlayer(room, targetId, 'night')
      state.nightDeaths.push(targetId)
    }
  }

  state.night.lastGuardianTarget = state.night.guardianTarget
  state.night.targets      = {}
  state.night.guardianTarget  = null
  state.night.fateweaverGuard = null

  // Lover chain deaths
  const heartbreak = triggerLoverChain(room)
  if (heartbreak && !state.nightDeaths.includes(heartbreak)) state.nightDeaths.push(heartbreak)

  // Flag hunter for revenge (any cause except fateweaver-kill card)
  for (const deadId of state.nightDeaths) {
    const rs = roleState(room, deadId)
    if (rs?.role === 'hunter' && rs?.eliminationReason !== 'fateweaver-kill' && !state.pendingHunterRevenge) {
      state.pendingHunterRevenge = { hunterId: deadId, nextPhase: null }
    }
  }
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
  const assignments = room.fateWerewolfSetup?.roleAssignments ?? {}
  const baseDeck = roleDecksByCount[count] ?? roleDecksByCount[6]
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
      const base = { role, team: roleDefinitions[role]?.team || 'moon', alive: true, roleAcknowledged: false, eliminationReason: null }
      if (role === 'fateweaver') base.fateWeaverCards = { kill: true, save: true, guard: true }
      return [player.id, base]
    })),
    seatOrder: players.map(p => p.id),
    night: { targets: {}, guardianTarget: null, lastGuardianTarget: null, fateweaverKill: null, fateweaverGuard: null },
    day: { votes: {}, pkCandidates: [], pkVotes: {}, speakerIndex: 0, r2OptIns: [] },
    fateCouncil: { votes: {} },
    fateHistory: [],
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

  return {
    phase: state.phase,
    nightStep: state.nightStep,
    timeOfDay: isDaytime ? 'day' : 'night',
    round: state.round ?? 1,
    seats: sorted.map((player, idx) => ({
      id: player.id, nickname: player.nickname,
      alive: Boolean(roleState(room, player.id)?.alive),
      seatNumber: idx + 1,
      isSpeaking: state.phase === 'discussion-r1' && speakerIndex === idx,
      isActiveStep: false,
    })),
    nightDeaths: isDaytime ? (state.nightDeaths ?? []) : [],
    speakerNickname: state.phase === 'discussion-r1' ? (sorted[speakerIndex]?.nickname ?? null) : null,
    fateCard: isDaytime ? (state.currentFateCard ?? null) : null,
    voteProgress: ['voting', 'pk-voting'].includes(state.phase)
      ? { cast: Object.keys(state.day?.votes ?? {}).length, expected: alivePlayers(room).length }
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

  const roleDef = roleDefinitions[secret.role] || roleDefinitions.villager
  const wolfAllies = secret.role === 'werewolf'
    ? alivePlayers(room).filter(p => p.id !== playerId && roleState(room, p.id)?.role === 'werewolf').map(p => ({ id: p.id, nickname: p.nickname }))
    : []
  const oracleMsg = secret.role === 'oracle' && state.oracle?.current
    ? `神谕提示：玩家 ${state.oracle.current.nickname} 属于${state.oracle.current.team === 'wolf' ? '狼人' : '月光'}阵营。`
    : null

  const ns = state.nightStep
  let action = null

  if (state.phase === 'role-assignment' && secret.alive) {
    action = { type: 'confirm-role', label: secret.roleAcknowledged ? '已确认角色' : '我已查看我的角色', disabled: secret.roleAcknowledged }
  } else if (state.phase === 'night' && ns === 'cupid-action' && secret.alive && secret.role === 'cupid') {
    action = { type: 'cupid-bind', label: '选择两名玩家成为恋人（可以选择自己）',
      targets: alivePlayers(room).map(p => ({ id: p.id, nickname: p.nickname })),
      selectedTargetIds: state.night?.cupidTargets ?? [] }
  } else if (state.phase === 'night' && ns === 'guardian-action' && secret.alive && secret.role === 'guardian') {
    action = { type: 'guardian-protect', label: '选择今晚守护的玩家', selectedTargetId: state.night?.guardianTarget || '',
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
    action = { type: 'fate-weaver-card',
      label: wolfTargetName ? `${wolfTargetName}遭受袭击` : '今晚无人遭受袭击',
      wolfTargetName, availableCards,
      targets: alivePlayers(room).map(p => ({ id: p.id, nickname: p.nickname })) }
  } else if (state.phase === 'night' && ns === 'oracle-action' && secret.alive && secret.role === 'oracle') {
    action = { type: 'oracle-confirm', label: '我已收到神谕' }
  } else if (state.phase === 'night' && ns === 'arsonist-mark' && secret.alive && secret.role === 'arsonist') {
    const marked = state.arsonist?.marked ?? []
    action = { type: 'arsonist-mark',
      label: `选择今晚标记的目标（已标记 ${marked.length} 人）`,
      targets: alivePlayers(room).filter(p => p.id !== playerId).map(p => ({ id: p.id, nickname: p.nickname, marked: marked.includes(p.id) })),
      markedCount: marked.length }
  } else if (state.phase === 'hunter-revenge' && playerId === state.pendingHunterRevenge?.hunterId) {
    action = { type: 'hunter-revenge', label: '你已死亡，选择带走一名玩家殉葬（可跳过）',
      targets: alivePlayers(room).map(p => ({ id: p.id, nickname: p.nickname })),
      canSkip: true }
  } else if (state.phase === 'voting' && secret.alive) {
    action = { type: 'vote-target', label: '投票放逐', selectedTargetId: state.day?.votes?.[playerId] || '',
      targets: alivePlayers(room).filter(p => p.id !== playerId).map(p => ({ id: p.id, nickname: p.nickname })) }
  } else if (state.phase === 'pk-voting' && secret.alive && !(state.day?.pkCandidates ?? []).includes(playerId)) {
    action = { type: 'pk-vote', label: 'PK投票', selectedTargetId: state.day?.pkVotes?.[playerId] || '',
      targets: (state.day?.pkCandidates ?? []).map(id => ({ id, nickname: room.players.get(id)?.nickname ?? id })) }
  } else if (!secret.alive && state.phase === 'fate-council') {
    action = { type: 'fate-vote', label: '投出命运选择', selectedTendency: state.fateCouncil?.votes?.[playerId] || '',
      tendencies: Object.values(fateTendencies) }
  }

  // Lover info: show partner identity to each lover
  const lovers = state.lovers ?? []
  const loverInfo = lovers.includes(playerId) && lovers.length === 2
    ? (() => {
        const otherId = lovers.find(id => id !== playerId)
        const otherRs = roleState(room, otherId)
        const otherDef = roleDefinitions[otherRs?.role] ?? roleDefinitions.villager
        return { partnerId: otherId, partnerNickname: room.players.get(otherId)?.nickname ?? '', partnerRole: otherDef.name }
      })()
    : null

  return { playerId, nickname: player.nickname, alive: Boolean(secret.alive), phase: state.phase, role: roleDef, team: secret.team, wolfAllies, oracleMessage: oracleMsg, loverInfo, privateBlessing: '', tarotCards: [], action, promptTitle: '', promptBody: '' }
}

// ── Phase advance engine ───────────────────────────────────────
export async function advanceWerewolf(room) {
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
      drawFateCard(room); refreshOracleWhisper(room)
      setPhase(room, 'fate-council'); state.nightStep = null
      state.lastOutcome = '夜晚的秘密已经落定，命运议会开始。'
    }
    return
  }

  if (state.phase === 'hunter-revenge') {
    const nextPhase = state.pendingHunterRevenge?.nextPhase ?? 'fate-council'
    state.pendingHunterRevenge = null
    if (nextPhase === 'fate-council') {
      drawFateCard(room); refreshOracleWhisper(room)
      setPhase(room, 'fate-council')
      state.lastOutcome = '命运议会开始。'
    } else {
      const v = checkVictory(room)
      if (v) { state.victory = v; state.lastOutcome = `${v.winner}获得了最终的胜利！` }
      setPhase(room, 'victory-check')
    }
    return
  }

  if (state.phase === 'fate-council') { setPhase(room, 'fate-card-reveal'); state.lastOutcome = state.currentFateCard ? `命运翻开了：${state.currentFateCard.title}` : '命运的牌面已翻开。'; return }
  if (state.phase === 'fate-card-reveal') { setPhase(room, 'fate-blessing'); state.lastOutcome = '命运眷顾了一位玩家。'; return }
  if (state.phase === 'fate-blessing') { setPhase(room, 'night-results'); state.lastOutcome = nightDeathsMessage(room); return }
  if (state.phase === 'night-results') { setPhase(room, 'discussion-r1'); state.day.speakerIndex = 0; state.lastOutcome = '请玩家依次发言。'; return }
  if (state.phase === 'discussion-r1') { setPhase(room, 'discussion-r2'); state.day.r2OptIns = []; state.lastOutcome = '进入第二轮自愿发言。'; return }
  if (state.phase === 'discussion-r2') { state.day.votes = {}; setPhase(room, 'voting'); state.lastOutcome = '发言结束，投票开始。'; return }

  if (state.phase === 'voting') {
    const result = resolveVoting(room)
    if (result.tied) {
      state.day.pkCandidates = result.candidates; state.day.pkVotes = {}
      setPhase(room, 'pk-discussion'); state.lastOutcome = '出现平票，进入PK环节。'
    } else {
      state.executedPlayerId = result.targetId ?? null
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
    const pk = resolvePkVoting(room)
    state.executedPlayerId = pk.targetId ?? null
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
      state.night = { targets: {}, guardianTarget: null, lastGuardianTarget: state.night?.guardianTarget ?? null, fateweaverKill: null, fateweaverGuard: null }
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
      if (wt && !wt.startsWith('__')) state.night.targets = {}
      secret.fateWeaverCards.save = false
    } else if (cardId === 'guard') {
      if (!cards.guard) return { status: 400, error: 'Guard card already used' }
      if (!targetId || !roleState(room, targetId)?.alive) return { status: 400, error: 'Invalid guard target' }
      state.night.fateweaverGuard = targetId
      secret.fateWeaverCards.guard = false
    }
    // 'skip': no cost
    return { status: 200, allSubmitted: true, private: privateWerewolfState(room, playerId) }
  }
  if (type === 'oracle-confirm') {
    if (state.phase !== 'night' || state.nightStep !== 'oracle-action') return { status: 409, error: 'Wrong phase/step' }
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
