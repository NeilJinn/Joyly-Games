import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useSSE } from '../../../src/hooks/useSSE'
import { useRoomStore } from '../../../src/stores/roomStore'
import { usePlayerStore } from '../../../src/stores/playerStore'
import type { WerewolfPublicState, WerewolfPrivateState, WerewolfAction } from '../shared/types'

const A = (n: string) => `/games/fate-werewolf/assets/${n}`
const gold = 'rgb(189,163,113)'
const goldBorder = 'rgba(196,150,74,.5)'

// Screen 5 exact values from cards.js
const CARD_W = 237, CARD_H = 391

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
            position: 'absolute', left: '50%', top: 55,
            transform: 'translateX(-50%)',
            width: 155, height: 245,
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
            position: 'absolute', left: 0, right: 0, bottom: 43,
            textAlign: 'center', fontFamily: "'Jaini', serif",
            fontSize: 25, lineHeight: '100%',
            color: '#89601c', textTransform: 'capitalize',
            textShadow: '0 3px 1px rgba(0,0,0,.46)',
          }}>{priv.role.name}</span>
        </div>
      </div>
    </div>
  )
}

// ── Action panel (voting, night actions, etc.) ────────────────────────────────
function ActionPanel({ action, onSubmit }: { action: WerewolfAction; onSubmit: (p: Record<string, string>) => Promise<void> }) {
  const [selectedTarget,   setSelectedTarget]  = useState(action.selectedTargetId ?? '')
  const [selectedTendency, setTendency]         = useState(action.selectedTendency ?? '')
  const [selectedOption,   setOption]           = useState('kill')
  const [loading,          setLoading]          = useState(false)

  async function handleSubmit() {
    if (loading) return
    setLoading(true)
    try {
      await onSubmit({ type: action.type, targetId: selectedTarget, tendency: selectedTendency, option: selectedOption, cardId: selectedTarget || 'skip' })
    } finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 24px', width: '100%', boxSizing: 'border-box' }}>
      <p style={{ color: gold, fontSize: 18, textAlign: 'center', fontFamily: "'Jaini', system-ui, sans-serif", margin: 0 }}>{action.label}</p>

      {action.targets && action.targets.length > 0 && action.targets.map(t => (
        <button key={t.id} onClick={() => setSelectedTarget(t.id)} style={{ padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Jaini', system-ui, sans-serif", fontSize: 18, border: `1.5px solid ${selectedTarget === t.id ? gold : goldBorder}`, background: selectedTarget === t.id ? 'rgba(196,150,74,.18)' : 'transparent', color: selectedTarget === t.id ? gold : 'rgba(255,255,255,.7)', transition: '.15s' }}>
          {t.nickname}
        </button>
      ))}

      {action.wolfOptions && action.wolfOptions.map(opt => (
        <button key={opt.id} onClick={() => setOption(opt.id)} style={{ padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Jaini', system-ui, sans-serif", fontSize: 16, border: `1.5px solid ${selectedOption === opt.id ? 'rgb(242,94,91)' : goldBorder}`, background: selectedOption === opt.id ? 'rgba(242,94,91,.15)' : 'transparent', color: selectedOption === opt.id ? 'rgb(242,94,91)' : 'rgba(255,255,255,.7)' }}>
          {opt.label}
        </button>
      ))}

      {action.tendencies && action.tendencies.map(t => (
        <button key={t.id} onClick={() => setTendency(t.id)} style={{ padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Jaini', system-ui, sans-serif", fontSize: 18, border: `1.5px solid ${selectedTendency === t.id ? 'rgb(171,71,188)' : goldBorder}`, background: selectedTendency === t.id ? 'rgba(171,71,188,.18)' : 'transparent', color: selectedTendency === t.id ? 'rgb(206,147,216)' : 'rgba(255,255,255,.7)' }}>
          {t.title}
        </button>
      ))}

      {action.cards && action.cards.map(c => (
        <button key={c.id} onClick={() => setSelectedTarget(c.id)} style={{ padding: '10px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: "'Jaini', system-ui, sans-serif", fontSize: 18, border: `1.5px solid ${selectedTarget === c.id ? gold : goldBorder}`, background: selectedTarget === c.id ? 'rgba(196,150,74,.18)' : 'transparent', color: selectedTarget === c.id ? gold : 'rgba(255,255,255,.7)', opacity: c.used ? 0.4 : 1 }}>
          {c.label}
        </button>
      ))}

      <button onClick={handleSubmit} disabled={action.disabled || loading} style={{ marginTop: 4, padding: '14px', borderRadius: 999, cursor: 'pointer', fontFamily: "'Jaini', system-ui, sans-serif", fontSize: 20, background: action.disabled || loading ? 'rgba(196,150,74,.3)' : 'rgb(230,183,109)', color: action.disabled || loading ? 'rgba(255,255,255,.4)' : '#16130f', border: 'none', letterSpacing: '.4px' }}>
        {loading ? '提交中...' : action.label}
      </button>
    </div>
  )
}

// ── Waiting / info view ───────────────────────────────────────────────────────
function WaitingView({ priv }: { priv: WerewolfPrivateState }) {
  return (
    <div style={{ padding: '0 24px', textAlign: 'center' }}>
      {priv.promptTitle && (
        <p style={{ color: gold, fontSize: 20, fontFamily: "'Jaini', serif", margin: '0 0 8px' }}>{priv.promptTitle}</p>
      )}
      {priv.promptBody && (
        <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 15, margin: 0 }}>{priv.promptBody}</p>
      )}
      {priv.wolfAllies.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p style={{ color: 'rgb(242,94,91)', fontFamily: "'Jaini', serif", fontSize: 18, margin: '0 0 8px' }}>你的同伴：</p>
          {priv.wolfAllies.map(a => (
            <p key={a.id} style={{ color: 'rgba(255,255,255,.7)', fontFamily: "'Jaini', serif", fontSize: 20, margin: '4px 0' }}>{a.nickname}</p>
          ))}
        </div>
      )}
      {priv.oracleMessage && (
        <div style={{ marginTop: 20, padding: 14, borderRadius: 8, background: 'rgba(196,150,74,.1)', border: '1px solid rgba(196,150,74,.3)' }}>
          <p style={{ color: gold, fontSize: 14, fontStyle: 'italic', margin: 0 }}>{priv.oracleMessage}</p>
        </div>
      )}
    </div>
  )
}

// ── Scale wrapper: shrinks to fit viewport width, scrolls vertically ──────────
function ScaledPhone({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const fn = () => setScale(Math.min(1, window.innerWidth / 402))
    fn()
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return (
    <div style={{ background: '#2e2e2e', minHeight: '100dvh', display: 'flex', justifyContent: 'center' }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
        {children}
      </div>
    </div>
  )
}

// ── Entry point ───────────────────────────────────────────────────────────────
export default function FateWerewolfPhone() {
  const { code }       = useParams<{ code: string }>()
  const [searchParams] = useSearchParams()
  useSSE(code ?? null)
  const room           = useRoomStore(s => s.room)
  const storedPlayerId = usePlayerStore(s => s.playerId)
  const playerId       = searchParams.get('pid') || storedPlayerId
  const pub            = room?.gameState as WerewolfPublicState | null
  const [priv, setPriv]     = useState<WerewolfPrivateState | null>(null)
  const [revealed, setRevealed] = useState(false)

  const fetchPrivate = useCallback(async () => {
    if (!code || !playerId) return
    try {
      const res  = await fetch(`/api/rooms/${code}/werewolf/private/${playerId}`)
      const data = await res.json() as { privateState?: WerewolfPrivateState }
      if (data.privateState) setPriv(data.privateState)
    } catch { /* retain last known state */ }
  }, [code, playerId])

  useEffect(() => { void fetchPrivate() }, [fetchPrivate, pub?.phase, pub?.nightStep])

  async function handleAction(payload: Record<string, string>) {
    if (!code || !playerId) return
    const res  = await fetch(`/api/rooms/${code}/werewolf/action`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, ...payload }),
    })
    const data = await res.json() as { privateState?: WerewolfPrivateState }
    if (data.privateState) setPriv(data.privateState)
  }

  // Loading
  if (!priv) {
    return (
      <ScaledPhone>
        <div style={{ position: 'relative', width: 402, height: 1150, background: 'linear-gradient(180deg,rgba(214,159,83,.3) 36.06%,rgba(0,0,0,.3) 100%),#2e2e2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: "'Jaini', serif", fontSize: 20, color: 'rgba(255,255,255,.4)' }}>连接中...</span>
        </div>
      </ScaledPhone>
    )
  }

  const phase      = pub?.phase ?? 'role-assignment'
  const phaseName  = PHASE_NAMES[phase] ?? phase
  const seatNumber = pub?.seats.find(s => s.id === priv.playerId)?.seatNumber ?? '?'

  // ── Screen 5 — exact positions from design HTML ───────────────────────────
  return (
    <ScaledPhone>
      {/* Container: 402×1150, same background as design */}
      <div style={{ position: 'relative', width: 402, minHeight: 1150, background: 'linear-gradient(180deg,rgba(214,159,83,.3) 36.06%,rgba(0,0,0,.3) 100%),#2e2e2e', fontFamily: "'Jaini', serif" }}>

        {/* Phase header — left:33 top:31 width:335, column flex gap:6 */}
        <div style={{ position: 'absolute', left: 33, top: 31, width: 335, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 20, lineHeight: '100%', textAlign: 'center', color: gold, textShadow: '0 3px 1px rgba(0,0,0,.46)' }}>Now...It's the</span>
          <span style={{ fontSize: 54, lineHeight: '100%', textAlign: 'center', color: 'rgb(242,94,91)', textShadow: '0 3px 1px rgba(0,0,0,.46)' }}>{phaseName}</span>
        </div>

        {/* Divider — left:116 top:172 170×29 */}
        <div style={{ position: 'absolute', left: 116, top: 172, width: 170, height: 29, background: `url(${A('divider.png')}) center / contain no-repeat` }} />

        {/* Player number — left:33 top:209 width:335, column flex gap:8 */}
        <div style={{ position: 'absolute', left: 33, top: 209, width: 335, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 24, lineHeight: '100%', textAlign: 'center', alignSelf: 'stretch', color: gold, textShadow: '0 3px 1px rgba(0,0,0,.46)' }}>Your player number is...</span>
          <span style={{ fontSize: 128, lineHeight: '100%', textAlign: 'center', alignSelf: 'stretch', color: gold, textShadow: '0 3px 1px rgba(0,0,0,.46)' }}>{seatNumber}</span>
        </div>

        {/* Role card — left:82 top:417 */}
        <div style={{ position: 'absolute', left: 82, top: 417 }}>
          <RoleCard priv={priv} onReveal={setRevealed} />
        </div>

        {/* "Tap to reveal role" — left:33 top:838 width:335 height:32 */}
        <span
          onClick={() => {}} // RoleCard handles click; this is display-only text
          style={{ position: 'absolute', left: 33, top: 838, width: 335, height: 32, cursor: 'pointer', fontSize: 24, lineHeight: '100%', textAlign: 'center', color: gold, textShadow: '0 3px 1px rgba(0,0,0,.46)' }}
        >
          {revealed ? 'Tap to hide role' : 'Tap to reveal role'}
        </span>

        {/* Notes / action area — left:33 top:929 width:335 */}
        <div style={{ position: 'absolute', left: 33, top: 929, width: 335, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          {priv.action
            ? <ActionPanel action={priv.action} onSubmit={handleAction} />
            : (
              <WaitingView priv={priv} />
            )
          }
          {/* Blessing */}
          {priv.privateBlessing && (
            <div style={{ marginTop: 12, padding: 14, borderRadius: 8, background: 'rgba(196,150,74,.1)', border: '1px solid rgba(196,150,74,.3)', width: '100%', boxSizing: 'border-box' }}>
              <p style={{ color: gold, fontSize: 14, fontStyle: 'italic', textAlign: 'center', margin: 0 }}>✦ {priv.privateBlessing}</p>
            </div>
          )}
          {/* Notes (shown when no action) */}
          {!priv.action && (
            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 24, lineHeight: '130%', textAlign: 'center', alignSelf: 'stretch', color: 'rgba(255,255,255,.4)', textShadow: '0 3px 1px rgba(0,0,0,.46)' }}>Notes</span>
              <span style={{ fontSize: 16, lineHeight: '130%', textAlign: 'center', alignSelf: 'stretch', color: 'rgba(255,255,255,.4)', textShadow: '0 3px 1px rgba(0,0,0,.46)' }}>Your phone will vibrate if you need to wake up</span>
            </div>
          )}
        </div>

      </div>
    </ScaledPhone>
  )
}
