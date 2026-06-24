// ── Night step sequence ────────────────────────────────────────
const NIGHT_STEPS = [
  { id: 'guardian-action',      requiredRole: 'guardian' },
  { id: 'wolf-action',          requiredRole: 'werewolf' },
  { id: 'fate-weaver-action',   requiredRole: 'fateweaver' },
  { id: 'oracle-action',        requiredRole: 'oracle' },
]

function stateOf(room) { return room.gameState }

function nightStepsForRoom(room) {
  const roles = new Set(Object.values(stateOf(room).players || {}).map(p => p.role))
  return NIGHT_STEPS.filter(s => roles.has(s.requiredRole)).map(s => s.id)
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
  werewolf:   { id: 'werewolf',   name: '狼人',       team: 'wolf', cardTitle: '狼人',       summary: '夜间选择击杀目标',             accent: '#c0392b' },
  guardian:   { id: 'guardian',   name: '守护者',     team: 'moon', cardTitle: '守护者',     summary: '每夜守护一位玩家，不可连续守护', accent: '#2980b9' },
  oracle:     { id: 'oracle',     name: '神谕者',     team: 'moon', cardTitle: '神谕者',     summary: '每夜收到一条阵营神谕提示',       accent: '#8e44ad' },
  fateweaver: { id: 'fateweaver', name: '命运编织者', team: 'moon', cardTitle: '命运编织者', summary: '可用卡牌干预命运',               accent: '#16a085' },
  villager:   { id: 'villager',   name: '村民',       team: 'moon', cardTitle: '村民',       summary: '白天投票识破狼人',               accent: '#7f8c8d' },
}

// Standard Chinese werewolf configurations
// 5-6p: no guardian (too powerful for small games)
// Guardian enters at 7+
const roleDecksByCount = {
  5:  ['werewolf', 'werewolf', 'oracle', 'villager', 'villager'],
  6:  ['werewolf', 'werewolf', 'oracle', 'fateweaver', 'villager', 'villager'],
  7:  ['werewolf', 'werewolf', 'oracle', 'fateweaver', 'guardian', 'villager', 'villager'],
  8:  ['werewolf', 'werewolf', 'werewolf', 'oracle', 'fateweaver', 'guardian', 'villager', 'villager'],
  9:  ['werewolf', 'werewolf', 'werewolf', 'oracle', 'fateweaver', 'guardian', 'villager', 'villager', 'villager'],
  10: ['werewolf', 'werewolf', 'werewolf', 'oracle', 'fateweaver', 'guardian', 'villager', 'villager', 'villager', 'villager'],
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

// ── Victory check ──────────────────────────────────────────────
function checkVictory(room) {
  const alive = alivePlayers(room)
  const wolves = alive.filter(p => roleState(room, p.id)?.role === 'werewolf')
  const villagers = alive.filter(p => roleState(room, p.id)?.team === 'moon')
  if (wolves.length === 0) return { winner: '村庄阵营', title: '村庄获胜！', body: '所有狼人已被放逐，村庄获得了最终的胜利。' }
  if (wolves.length >= villagers.length) return { winner: '狼人阵营', title: '狼人获胜！', body: '狼人数量已超过平民，黑夜笼罩了村庄。' }
  return null
}

// ── Night resolution ───────────────────────────────────────────
function resolveNight(room) {
  const state = stateOf(room)
  const targetId = majorityTarget(state.night?.targets ?? {})
  const protected_ = state.night?.guardianTarget
  state.nightDeaths = []
  if (targetId && targetId !== protected_) {
    const victim = roleState(room, targetId)
    if (victim?.alive && victim.role !== 'werewolf') {
      killPlayer(room, targetId, 'night')
      state.nightDeaths = [targetId]
    }
  }
  state.night.lastGuardianTarget = state.night.guardianTarget
  state.night.targets = {}
  state.night.guardianTarget = null
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
      return [player.id, { role, team: roleDefinitions[role]?.team || 'moon', alive: true, roleAcknowledged: false, eliminationReason: null }]
    })),
    seatOrder: players.map(p => p.id),
    night: { targets: {}, guardianTarget: null, lastGuardianTarget: null },
    day: { votes: {}, pkCandidates: [], pkVotes: {}, speakerIndex: 0, r2OptIns: [] },
    fateCouncil: { votes: {} },
    fateHistory: [],
    currentFateCard: null,
    oracle: { current: null },
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
    action = { type: 'fate-weaver-card', label: wolfTargetName ? `${wolfTargetName}遭受袭击，是否使用卡牌？` : '今晚无人遭受袭击',
      cards: [{ id: 'save', label: '使用救人牌', used: false }, { id: 'skip', label: '今晚不使用', used: false }] }
  } else if (state.phase === 'night' && ns === 'oracle-action' && secret.alive && secret.role === 'oracle') {
    action = { type: 'oracle-confirm', label: '我已收到神谕' }
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

  return { playerId, nickname: player.nickname, alive: Boolean(secret.alive), phase: state.phase, role: roleDef, team: secret.team, wolfAllies, oracleMessage: oracleMsg, privateBlessing: '', tarotCards: [], action, promptTitle: '', promptBody: '' }
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
      drawFateCard(room); refreshOracleWhisper(room)
      setPhase(room, 'fate-council'); state.nightStep = null
      state.lastOutcome = '夜晚的秘密已经落定，命运议会开始。'
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
      if (result.targetId) killPlayer(room, result.targetId, 'vote')
      setPhase(room, 'execution')
      state.lastOutcome = result.targetId ? `${room.players.get(result.targetId)?.nickname ?? result.targetId}被放逐了。` : '投票无效，今日无人被放逐。'
    }
    return
  }

  if (state.phase === 'pk-discussion') { state.day.pkVotes = {}; setPhase(room, 'pk-voting'); state.lastOutcome = '请非PK玩家投票。'; return }

  if (state.phase === 'pk-voting') {
    const pk = resolvePkVoting(room)
    state.executedPlayerId = pk.targetId ?? null
    if (pk.targetId) killPlayer(room, pk.targetId, 'pk-vote')
    setPhase(room, 'execution')
    state.lastOutcome = pk.targetId ? `${room.players.get(pk.targetId)?.nickname ?? pk.targetId}在PK中被放逐。` : 'PK平票，今日无人被放逐。'
    return
  }

  if (state.phase === 'execution') { setPhase(room, 'victory-check'); const v = checkVictory(room); if (v) { state.victory = v; state.lastOutcome = `${v.winner}获得了最终的胜利！` }; return }

  if (state.phase === 'victory-check') {
    if (state.victory) { setPhase(room, 'complete') }
    else {
      state.round = (state.round ?? 1) + 1
      state.nightDeaths = []; state.executedPlayerId = null; state.currentFateCard = null
      state.night = { targets: {}, guardianTarget: null, lastGuardianTarget: state.night?.guardianTarget ?? null }
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
    if (String(payload.cardId) === 'save') { const wt = majorityTarget(state.night?.targets ?? {}); if (wt && !wt.startsWith('__')) state.night.targets = {} }
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

const testerRoleOrder = ['werewolf', 'villager', 'guardian', 'oracle', 'fateweaver']
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
