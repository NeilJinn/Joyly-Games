import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useRoomStore } from '../../../src/stores/roomStore'
import { usePlayerStore } from '../../../src/stores/playerStore'
import type { Room } from '../../../src/types/room'
import type { WerewolfPublicState, WerewolfPrivateState, WerewolfAction } from '../shared/types'

const A = (n: string) => `/games/fate-werewolf/assets/${n}`
const gold = 'rgb(189,163,113)'
const goldBorder = 'rgba(196,150,74,.5)'

// Compact phone variant: preserve the same card artwork while leaving room for
// the player's current action and personal notes.
const CARD_W = 190, CARD_H = 313

// Card back gradient — exactly as cards.js roleCard()
const BACK_GRAD = 'linear-gradient(167deg,rgba(0,0,0,0) 6.19%,rgba(211,132,28,.2) 13.06%,rgba(211,132,28,0) 17.64%,rgba(211,132,28,0) 90.97%,rgba(211,132,28,.2) 97.84%,rgba(211,132,28,0) 101.05%)'
// Card front gradient — opacity .22 on front face
const FRONT_GRAD = 'linear-gradient(167deg,rgba(0,0,0,0) 6.19%,rgba(211,132,28,.22) 13.06%,rgba(211,132,28,0) 17.64%,rgba(211,132,28,0) 90.97%,rgba(211,132,28,.22) 97.84%,rgba(211,132,28,0) 101.05%)'

const PHASE_NAMES: Record<string, string> = {
  'role-assignment':   '角色分配',
  'first-night-setup': '首夜',
  'night':             '夜晚',
  'fate-council':      '命运议会',
  'fate-card-reveal':  '命运揭晓',
  'fate-blessing':     '命运赐福',
  'night-results':     '昨夜结果',
  'discussion-r1':     '发言时刻',
  'discussion-r2':     '自由发言',
  'voting':            '投票',
  'pk-discussion':     'PK辩护',
  'pk-voting':         'PK投票',
  'execution':         '放逐',
  'victory-check':     '胜负判定',
  'complete':          '游戏结束',
}

// ── Role flip card — matches cards.js roleCard() exactly ─────────────────────
function RoleCard({ priv, onReveal }: { priv: WerewolfPrivateState; onReveal: (r: boolean) => void }) {
  const [revealed, setRevealed] = useState(false)
  const roleId = priv.role.id

  function toggle() {
    const next = !revealed
    setRevealed(next)
    onReveal(next)
  }

  return (
    // outer wrap: perspective, cursor pointer — mirrors makeFlipCard()
    <div onClick={toggle} style={{ position: 'relative', width: CARD_W, height: CARD_H, perspective: 1400, cursor: 'pointer', flex: 'none' }}>
      {/* inner: transform-style preserve-3d, transition same as cards.js */}
      <div style={{
        position: 'relative', width: CARD_W, height: CARD_H,
        transformStyle: 'preserve-3d',
        transition: 'transform .75s cubic-bezier(.2,.75,.2,1)',
        transform: revealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>
        {/* BACK — cards.js: url(card-back.png) center / 100% 100% */}
        <div style={{
          position: 'absolute', left: 0, top: 0, width: CARD_W, height: CARD_H,
          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          borderRadius: 10, overflow: 'hidden',
          boxShadow: '0 6px 8.9px 4px rgba(0,0,0,.65)',
          background: `url(${A('card-back.png')}) center / 100% 100% no-repeat, ${BACK_GRAD}, #0a0a0a`,
        }} />
        {/* FRONT */}
        <div style={{
          position: 'absolute', left: 0, top: 0, width: CARD_W, height: CARD_H,
          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          borderRadius: 10, overflow: 'hidden',
          boxShadow: '0 6px 8.9px 4px rgba(0,0,0,.65)',
          background: `${FRONT_GRAD}, #0a0a0a`,
        }}>
          {/* Art — background div, top center / contain, exactly as cards.js */}
          <div style={{
            position: 'absolute', left: '50%', top: 44,
            transform: 'translateX(-50%)',
            width: 125, height: 205,
            background: `url(${A(`identity-${roleId}.png`)}) top center / contain no-repeat`,
          }} />
          {/* Frame overlay — 100% 100% stretch */}
          <div style={{
            position: 'absolute', left: 0, top: 0, width: CARD_W, height: CARD_H,
            borderRadius: 10,
            background: `url(${A('card-front-alt.png')}) center / 100% 100% no-repeat`,
          }} />
          {/* Role name label */}
          <span style={{
            position: 'absolute', left: 0, right: 0, bottom: 35,
            textAlign: 'center', fontFamily: "'Jaini', serif",
            fontSize: 20, lineHeight: '100%',
            color: '#89601c', textTransform: 'capitalize',
            textShadow: '0 3px 1px rgba(0,0,0,.46)',
          }}>{priv.role.name}</span>
        </div>
      </div>
    </div>
  )
}

// ── Action panel (voting, night actions, etc.) ────────────────────────────────
type ActionPayload = Record<string, unknown>

const journalKey = (roomCode: string, playerId: string) => `fate-werewolf:journal:${roomCode}:${playerId}`
export type PlayerJournal = { suspects: string; trusts: string; notes: string }
export function loadPlayerJournal(roomCode: string, playerId: string): PlayerJournal {
  try { return { suspects: '', trusts: '', notes: '', ...JSON.parse(localStorage.getItem(journalKey(roomCode, playerId)) ?? '{}') } }
  catch { return { suspects: '', trusts: '', notes: '' } }
}
export function savePlayerJournal(roomCode: string, playerId: string, journal: PlayerJournal) {
  localStorage.setItem(journalKey(roomCode, playerId), JSON.stringify(journal))
}

const choiceStyle = (chosen: boolean, accent = gold): React.CSSProperties => ({ minHeight: 44, padding: '9px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Jaini', system-ui, sans-serif", fontSize: 15, lineHeight: 1.2, border: `1.5px solid ${chosen ? accent : goldBorder}`, background: chosen ? 'rgba(196,150,74,.18)' : 'rgba(8,10,18,.26)', color: chosen ? accent : 'rgba(255,255,255,.78)' })

/** Renders each server action explicitly so its required selection can be validated before submit. */
export function ActionPanel({ action, onSubmit }: { action: WerewolfAction; onSubmit: (p: ActionPayload) => Promise<void> }) {
  const [targetId, setTargetId] = useState(action.type === 'multi-target' ? '' : ('selectedTargetId' in action ? action.selectedTargetId ?? '' : ''))
  const [targetIds, setTargetIds] = useState<string[]>(action.type === 'multi-target' ? action.selectedTargetIds ?? [] : [])
  const [cardId, setCardId] = useState(action.type === 'card-and-target' ? action.selectedCardId ?? '' : '')
  const [tendency, setTendency] = useState(action.type === 'fate-vote' ? action.selectedTendency ?? '' : '')
  const [option, setOption] = useState(action.type === 'wolf-night-action' ? action.selectedOption ?? 'kill' : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (payload: ActionPayload) => {
    if (loading || action.disabled) return
    setLoading(true); setError('')
    try { await onSubmit(payload) }
    catch (reason) { setError(reason instanceof Error ? reason.message : '提交失败，请重试。') }
    finally { setLoading(false) }
  }
  const requireValue = (value: string, message: string) => {
    if (value) return true
    setError(message)
    return false
  }
  const renderTargets = (selected: string, select: (id: string) => void) => action.targets?.map(target => (
    <button key={target.id} type="button" onClick={() => select(target.id)} style={choiceStyle(selected === target.id)}>{target.nickname}</button>
  ))
  let controls: React.ReactNode
  if (action.type === 'select-target') {
    controls = <>{renderTargets(targetId, setTargetId)}{action.allowSkip && <button type="button" onClick={() => setTargetId('')} style={choiceStyle(!targetId)}>不使用</button>}<Submit label={action.label} loading={loading} disabled={action.disabled} ready={Boolean(targetId || action.allowSkip)} onClick={() => { if (targetId || action.allowSkip) void submit({ type: action.actionId, targetId }); else setError('请选择一名目标。') }} /></>
  } else if (action.type === 'wolf-night-action') {
    const needsTarget = option === 'kill'
    controls = <>{action.wolfOptions.map(item => <button key={item.id} type="button" onClick={() => setOption(item.id)} style={choiceStyle(option === item.id, 'rgb(242,94,91)')}>{item.label}</button>)}{needsTarget && renderTargets(targetId, setTargetId)}<Submit label={action.label} loading={loading} disabled={action.disabled} ready={!needsTarget || Boolean(targetId)} onClick={() => { if (!needsTarget || requireValue(targetId, '请选择击杀目标。')) void submit({ type: 'wolf-night-action', option, targetId }) }} /></>
  } else if (action.type === 'card-and-target') {
    const chosenCard = action.cards.find(card => card.id === cardId)
    controls = <>{action.cards.map(card => <button key={card.id} type="button" onClick={() => setCardId(card.id)} style={choiceStyle(cardId === card.id)}>{card.label}</button>)}{chosenCard?.requiresTarget && renderTargets(targetId, setTargetId)}<Submit label={action.label} loading={loading} disabled={action.disabled} ready={Boolean(cardId) && (!chosenCard?.requiresTarget || Boolean(targetId))} onClick={() => { if (!requireValue(cardId, '请选择一张卡牌。')) return; if (chosenCard?.requiresTarget && !requireValue(targetId, '请选择一名目标。')) return; void submit({ type: action.actionId, cardId, targetId }) }} /></>
  } else if (action.type === 'multi-target') {
    controls = <><p style={{ margin: 0, color: 'rgba(255,255,255,.6)', textAlign: 'center' }}>已选择 {targetIds.length}/{action.requiredTargetCount}</p>{action.targets.map(target => <button key={target.id} type="button" onClick={() => setTargetIds(current => current.includes(target.id) ? current.filter(id => id !== target.id) : current.length < action.requiredTargetCount ? [...current, target.id] : current)} style={choiceStyle(targetIds.includes(target.id))}>{target.nickname}</button>)}<Submit label={action.label} loading={loading} disabled={action.disabled} ready={targetIds.length === action.requiredTargetCount} onClick={() => { if (targetIds.length !== action.requiredTargetCount) { setError(`请选择 ${action.requiredTargetCount} 名不同的玩家。`); return } void submit({ type: action.actionId, targetIds }) }} /></>
  } else if (action.type === 'fate-vote') {
    controls = <>{action.tendencies.map(item => <button key={item.id} type="button" onClick={() => setTendency(item.id)} style={choiceStyle(tendency === item.id, 'rgb(206,147,216)')}>{item.title}</button>)}<Submit label={action.label} loading={loading} disabled={action.disabled} ready={Boolean(tendency)} onClick={() => { if (requireValue(tendency, '请选择命运倾向。')) void submit({ type: 'fate-vote', tendency }) }} /></>
  } else {
    controls = <Submit label={action.label} loading={loading} disabled={action.disabled} onClick={() => void submit({ type: action.type })} />
  }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', boxSizing: 'border-box' }}><p style={{ color: gold, fontSize: 16, lineHeight: 1.2, textAlign: 'center', fontFamily: "'Jaini', system-ui, sans-serif", margin: 0 }}>{action.label}</p>{controls}{error && <p role="alert" style={{ color: '#f28b82', margin: 0, textAlign: 'center', fontSize: 13 }}>{error}</p>}</div>
}

function Submit({ label, loading, disabled, ready = true, onClick }: { label: string; loading: boolean; disabled?: boolean; ready?: boolean; onClick: () => void }) {
  const unavailable = disabled || loading || !ready
  return <button type="button" onClick={onClick} disabled={unavailable} style={{ marginTop: 2, minHeight: 46, padding: '10px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: "'Jaini', system-ui, sans-serif", fontSize: 17, lineHeight: 1.2, background: unavailable ? 'rgba(196,150,74,.3)' : 'rgb(230,183,109)', color: unavailable ? 'rgba(255,255,255,.45)' : '#16130f', border: 'none', letterSpacing: '.2px' }}>{loading ? '提交中...' : label}</button>
}

// ── Waiting / info view ───────────────────────────────────────────────────────
function WaitingView({ priv }: { priv: WerewolfPrivateState }) {
  return (
    <div style={{ padding: 0, textAlign: 'center' }}>
      {priv.promptTitle && (
        <p style={{ color: gold, fontSize: 17, lineHeight: 1.2, fontFamily: "'Jaini', serif", margin: '0 0 6px' }}>{priv.promptTitle}</p>
      )}
      {priv.promptBody && (
        <p style={{ color: 'rgba(255,255,255,.58)', fontSize: 14, lineHeight: 1.45, margin: 0 }}>{priv.promptBody}</p>
      )}
      {priv.wolfAllies.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p style={{ color: 'rgb(242,94,91)', fontFamily: "'Jaini', serif", fontSize: 16, margin: '0 0 6px' }}>你的同伴：</p>
          {priv.wolfAllies.map(a => (
            <p key={a.id} style={{ color: 'rgba(255,255,255,.75)', fontFamily: "'Jaini', serif", fontSize: 16, margin: '3px 0' }}>{a.nickname}</p>
          ))}
        </div>
      )}
      {priv.oracleMessage && (
        <div style={{ marginTop: 14, padding: 11, borderRadius: 8, background: 'rgba(196,150,74,.1)', border: '1px solid rgba(196,150,74,.3)' }}>
          <p style={{ color: gold, fontSize: 13, lineHeight: 1.45, fontStyle: 'italic', margin: 0 }}>{priv.oracleMessage}</p>
        </div>
      )}
    </div>
  )
}

// ── Phone shell: keep the game readable on small screens without scaling down
// touch targets. The big-screen night image is the shared visual anchor.
function ScaledPhone({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', width: '100%', display: 'flex', justifyContent: 'center', background: `linear-gradient(rgba(7,9,16,.78),rgba(7,9,16,.96)), url(${A('bg-night-deep.jpg')}) center / cover fixed`, color: 'rgba(255,255,255,.86)' }}>
      <div style={{ width: 'min(100%, 402px)' }}>{children}</div>
    </div>
  )
}

// ── Entry point ───────────────────────────────────────────────────────────────
export interface FateWerewolfPhoneProps {
  /** Runtime props are supplied by Joyly; route params remain a direct-link fallback. */
  room?: Room
  code?: string
  playerId?: string | null
  embedded?: boolean
}

export default function FateWerewolfPhone(props: FateWerewolfPhoneProps = {}) {
  const { code: routeCode } = useParams<{ code: string }>()
  const [searchParams] = useSearchParams()
  const storedRoom      = useRoomStore(s => s.room)
  const code            = props.code ?? routeCode
  const room           = storedRoom ?? props.room ?? null
  const storedPlayerId = usePlayerStore(s => s.playerId)
  const playerId       = props.playerId || searchParams.get('pid') || storedPlayerId
  const pub            = room?.gameState as WerewolfPublicState | null
  const [priv, setPriv]     = useState<WerewolfPrivateState | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [journal, setJournal] = useState<PlayerJournal>({ suspects: '', trusts: '', notes: '' })

  const fetchPrivate = useCallback(async () => {
    if (!code || !playerId) return
    try {
      const res  = await fetch(`/api/rooms/${code}/werewolf/private/${playerId}`)
      const data = await res.json() as { privateState?: WerewolfPrivateState }
      if (data.privateState) setPriv(data.privateState)
    } catch { /* retain last known state */ }
  }, [code, playerId])

  useEffect(() => { void fetchPrivate() }, [fetchPrivate, pub?.phase, pub?.nightStep])
  useEffect(() => { if (code && playerId) setJournal(loadPlayerJournal(code, playerId)) }, [code, playerId])

  async function handleAction(payload: ActionPayload) {
    if (!code || !playerId) throw new Error('未找到玩家信息。')
    const res  = await fetch(`/api/rooms/${code}/werewolf/action`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, ...payload }),
    })
    const data = await res.json() as { privateState?: WerewolfPrivateState; error?: string }
    if (!res.ok || data.error) throw new Error(data.error || '操作未被接受。')
    if (data.privateState) setPriv(data.privateState)
  }

  function updateJournal(field: keyof PlayerJournal, value: string) {
    const next = { ...journal, [field]: value }
    setJournal(next)
    if (code && playerId) savePlayerJournal(code, playerId, next)
  }

  // Loading
  if (!priv) {
    return (
      <ScaledPhone>
        <div style={{ minHeight: '100dvh', padding: 24, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(rgba(7,9,16,.78),rgba(7,9,16,.96)), url(${A('bg-night-deep.jpg')}) center / cover fixed` }}>
          <span style={{ fontFamily: "'Jaini', serif", fontSize: 16, color: 'rgba(255,255,255,.58)' }}>连接中...</span>
        </div>
      </ScaledPhone>
    )
  }

  const phase      = pub?.phase ?? 'role-assignment'
  const phaseName  = PHASE_NAMES[phase] ?? phase
  const seatNumber = pub?.seats.find(s => s.id === priv.playerId)?.seatNumber ?? '?'

  // Compact responsive phone surface.
  return <CompactPhoneSurface priv={priv} phaseName={phaseName} seatNumber={seatNumber} revealed={revealed} onReveal={setRevealed} journal={journal} onJournalChange={updateJournal} onSubmit={handleAction} />
}

function CompactPhoneSurface({ priv, phaseName, seatNumber, revealed, onReveal, journal, onJournalChange, onSubmit }: {
  priv: WerewolfPrivateState
  phaseName: string
  seatNumber: number | string
  revealed: boolean
  onReveal: (revealed: boolean) => void
  journal: PlayerJournal
  onJournalChange: (field: keyof PlayerJournal, value: string) => void
  onSubmit: (payload: ActionPayload) => Promise<void>
}) {
  return (
    <div style={{ width: '100%', minHeight: '100dvh', boxSizing: 'border-box', padding: '20px 16px 40px', background: `linear-gradient(rgba(7,9,16,.78),rgba(7,9,16,.96)), url(${A('bg-night-deep.jpg')}) center / cover fixed`, fontFamily: "'Jaini', serif" }}>
      <header style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <span style={{ fontSize: 13, lineHeight: 1.2, color: gold, letterSpacing: '.08em', textShadow: '0 2px 1px rgba(0,0,0,.46)' }}>Now...It's the</span>
        <span style={{ fontSize: 'clamp(30px, 9vw, 38px)', lineHeight: 1, color: 'rgb(242,94,91)', textShadow: '0 3px 1px rgba(0,0,0,.46)' }}>{phaseName}</span>
        <div style={{ width: 130, height: 20, margin: '5px 0 1px', background: `url(${A('divider.png')}) center / contain no-repeat` }} />
      </header>

      <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }} aria-label="玩家编号">
        <span style={{ fontSize: 15, lineHeight: 1.25, color: gold, textShadow: '0 2px 1px rgba(0,0,0,.46)' }}>Your player number is...</span>
        <span style={{ fontSize: 'clamp(66px, 20vw, 82px)', lineHeight: .86, color: gold, textShadow: '0 3px 1px rgba(0,0,0,.46)' }}>{seatNumber}</span>
      </section>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>
        <RoleCard priv={priv} onReveal={onReveal} />
      </div>
      <div aria-live="polite" style={{ minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: 2, color: gold, fontSize: 15, lineHeight: 1.2, textShadow: '0 2px 1px rgba(0,0,0,.46)' }}>
        {revealed ? 'Tap to hide role' : 'Tap to reveal role'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 10 }}>
        {priv.action ? <ActionPanel action={priv.action} onSubmit={onSubmit} /> : <WaitingView priv={priv} />}
        {priv.privateBlessing && (
          <div style={{ padding: 11, borderRadius: 8, background: 'rgba(196,150,74,.1)', border: '1px solid rgba(196,150,74,.3)', width: '100%', boxSizing: 'border-box' }}>
            <p style={{ color: gold, fontSize: 13, lineHeight: 1.45, fontStyle: 'italic', textAlign: 'center', margin: 0 }}>✦ {priv.privateBlessing}</p>
          </div>
        )}
        <PersonalJournal journal={journal} onChange={onJournalChange} />
      </div>
    </div>
  )
}

function PersonalJournal({ journal, onChange }: { journal: PlayerJournal; onChange: (field: keyof PlayerJournal, value: string) => void }) {
  const fieldStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', borderRadius: 6, border: `1px solid ${goldBorder}`, background: 'rgba(0,0,0,.22)', color: 'rgba(255,255,255,.85)', padding: 8, fontFamily: 'inherit', fontSize: 14 }
  return <section aria-label="个人推理笔记" style={{ marginTop: 8, width: '100%', display: 'grid', gap: 6 }}>
    <span style={{ color: gold, textAlign: 'center', fontSize: 16, lineHeight: 1.2 }}>个人推理</span>
    <textarea aria-label="怀疑名单" value={journal.suspects} onChange={event => onChange('suspects', event.target.value)} placeholder="怀疑对象" style={fieldStyle} rows={2} />
    <textarea aria-label="信任名单" value={journal.trusts} onChange={event => onChange('trusts', event.target.value)} placeholder="信任对象" style={fieldStyle} rows={2} />
    <textarea aria-label="推理笔记" value={journal.notes} onChange={event => onChange('notes', event.target.value)} placeholder="记录你的推理…" style={fieldStyle} rows={4} />
  </section>
}
