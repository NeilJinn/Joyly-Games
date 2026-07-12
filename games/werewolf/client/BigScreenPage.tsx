import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useRoomStore } from '../../../src/stores/roomStore'
import { useFateWerewolfDirector } from './hooks/useFateWerewolfDirector'
import type { Room } from '../../../src/types/room'
import type { WerewolfPublicState, WerewolfFateCard, WerewolfPrivateState } from '../shared/types'

const A = (n: string) => `/games/fate-werewolf/assets/${n}`

const VICTORY_ILLUS: Record<string, string> = {
  '村庄阵营': A('illus-villager-won.png'),
  '狼人阵营': A('illus-werewolf-won.png'),
  '恋人阵营': A('illus-lovers-won.png'),
  '焚焰者':   A('illus-arsonist-won.png'),
  '梦境使者': A('illus-dream-walker-won.png'),
}

const NIGHT_PHASES = new Set(['lobby', 'role-assignment', 'first-night-setup', 'night', 'fate-council'])

// Night-step role call labels (Screen 2 style)
const NIGHT_ROLE_INFO: Record<string, { label: string; instruction: string }> = {
  'guardian-action':    { label: '守护者',     instruction: '请睁眼，选择今晚守护的玩家' },
  'wolf-action':        { label: '狼人',       instruction: '请睁眼，确认同伴，决定今晚行动' },
  'fate-weaver-action': { label: '命运编织者', instruction: '目标遭受袭击，是否使用卡牌？' },
  'oracle-action':      { label: '神谕者',     instruction: '请睁眼，今晚的神谕已送达你的手机' },
}

const DAY_SUBTITLES: Record<string, string> = {
  'fate-card-reveal': '命运揭晓',
  'fate-blessing':    '命运赐福',
  'night-results':    '昨夜结果',
  'discussion-r1':    '第一轮发言',
  'discussion-r2':    '自由发言',
  'voting':           '投票',
  'pk-discussion':    'PK · 最终辩护',
  'pk-voting':        'PK · 投票',
  'execution':        '放逐',
  'victory-check':    '胜负判定',
  'complete':         '游戏结束',
}

type CardStage = 'init' | 'center' | 'flip' | 'slide-right'
const FOREGROUND_UI_SCALE = 0.6
const DAY_EVENT_TOP = 150
const DAY_DIVIDER_TOP = 432
const DAY_NARRATION_TOP = 478
const DAY_ACTIVE_CONTENT_TOP = 548

// ── Corner decorations — same on every screen ────────────────────────────────
export function getCornerDecorationLayout(boardWidth = 1440, boardHeight = 810) {
  const topInset = 31
  const sideInset = 31
  const bottomInset = 31
  const sourceWidth = 696
  const sourceHeight = 975
  const sourceInnerBottomLineOffset = 13
  const scale = (boardHeight - topInset - bottomInset) / sourceHeight
  const width = sourceWidth * scale
  const height = sourceHeight * scale
  const innerBottomLineOffset = sourceInnerBottomLineOffset * scale

  return {
    top: topInset,
    topInset,
    sideInset,
    bottomInset,
    innerBottomLineOffset,
    scaleX: scale,
    scaleY: scale,
    left: {
      left: sideInset,
      width,
      height,
    },
    right: {
      left: boardWidth - sideInset - width,
      width,
      height,
    },
  }
}

export function getBottomIllustrationLayout() {
  const { bottomInset, innerBottomLineOffset } = getCornerDecorationLayout()
  return {
    left: 35,
    // Align with the ornamental frame's inner baseline, not its outer edge.
    bottom: bottomInset + innerBottomLineOffset,
    width: 1369,
    height: 393,
  }
}

function CornerDecs() {
  const layout = getCornerDecorationLayout()

  return (
    <>
      <div style={{ position: 'absolute', left: layout.left.left, top: layout.top, width: layout.left.width, height: layout.left.height, transform: 'scaleX(-1)', transformOrigin: 'center center', background: `url(${A('dec-corner-desat.png')}) center / 100% 100% no-repeat`, pointerEvents: 'none', zIndex: 1 }} />
      <div style={{ position: 'absolute', left: layout.right.left, top: layout.top, width: layout.right.width, height: layout.right.height, background: `url(${A('dec-corner-desat.png')}) center / 100% 100% no-repeat`, pointerEvents: 'none', zIndex: 1 }} />
    </>
  )
}

function ForegroundScale({ children, zIndex = 3 }: { children: React.ReactNode; zIndex?: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transform: `scale(${FOREGROUND_UI_SCALE})`,
        transformOrigin: 'top center',
        zIndex,
        pointerEvents: 'none',
      }}
    >
      {children}
    </div>
  )
}

// ── Player avatar bubble — matches p.avatarStyle from design renderVals() ────
// 100×100 circle, green ring (alive/ready), gold+dim (dead)
function AvatarBubble({ nickname, alive, isSpeaking }: { nickname: string; alive: boolean; isSpeaking?: boolean }) {
  return (
    <div style={{ position: 'relative', width: 153, height: 150, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
      <div style={{
        position: 'relative', width: 100, height: 100, borderRadius: '50%', flexShrink: 0,
        background: `url(${A('avatar.png')}) center / cover no-repeat, linear-gradient(rgba(0,0,0,.18),rgba(0,0,0,.18))`,
        boxShadow: alive
          ? 'inset 0 0 0 2px rgb(142,191,93)'
          : 'inset 0 0 0 1px rgba(189,163,113,.5)',
        opacity: alive ? 1 : 0.78,
      }}>
        {!alive && (
          <img src={A('icon-dead.png')} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
        )}
        {isSpeaking && alive && (
          <img src={A('icon-highlight.png')} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
        )}
      </div>
      <span style={{ fontFamily: "'Jaini', serif", fontSize: 24, lineHeight: '100%', textAlign: 'center', alignSelf: 'stretch', whiteSpace: 'nowrap', color: 'rgba(255,255,255,.85)', textShadow: '0 3px 1px rgba(0,0,0,.46)' }}>
        {nickname}
      </span>
    </div>
  )
}

// ── Bottom scene illustration with bottom-up wipe animation ─────────────────
function Illus({ src, bgSize, wipeOut = false }: { src: string; bgSize: string; wipeOut?: boolean }) {
  const [animKey, setAnimKey] = useState(0)
  const prev = useRef(src)
  const layout = getBottomIllustrationLayout()
  if (prev.current !== src) { prev.current = src; setAnimKey(k => k + 1) }
  return (
    <div key={animKey} className={wipeOut ? 'ww-illus-out' : 'ww-illus'} style={{ position: 'absolute', left: layout.left, bottom: layout.bottom, width: layout.width, height: layout.height, background: `url(${src}) ${bgSize} no-repeat`, pointerEvents: 'none', zIndex: 2 }} />
  )
}

// ── Arcana card multi-stage animation (Screen 4 / fate-card-reveal) ──────────
function ArcanaCard({ fateCard, cardStage }: { fateCard: WerewolfFateCard; cardStage: CardStage }) {
  const textVisible = cardStage === 'slide-right'
  const cardGrad = 'linear-gradient(169deg,rgba(0,0,0,0) 4.46%,rgba(211,132,28,.15) 11.49%,rgba(211,132,28,0) 16.18%,rgba(211,132,28,0) 91.19%,rgba(211,132,28,.15) 98.22%,rgba(211,132,28,0) 101.51%)'

  const base: React.CSSProperties = { position: 'absolute', width: 352, height: 697, transformOrigin: 'center center', perspective: 1400, zIndex: 10 }
  let wrapStyle: React.CSSProperties = { ...base, left: 1400, top: -300, opacity: 0 }
  let flipT = 'rotateY(0deg)'

  if (cardStage === 'center') {
    wrapStyle = { ...base, left: 544, top: 163, opacity: 1, transition: 'all 3.2s cubic-bezier(0.34,1.56,0.64,1)' }
  } else if (cardStage === 'flip') {
    wrapStyle = { ...base, left: 544, top: 163, opacity: 1 }
    flipT = 'rotateY(180deg)'
  } else if (cardStage === 'slide-right') {
    wrapStyle = { ...base, left: 900, top: 130, transform: 'rotate(12deg)', opacity: 1, transition: 'all 1s cubic-bezier(0.25,0.46,0.45,0.94)' }
    flipT = 'rotateY(180deg)'
  }

  return (
    <>
      {/* Left text — fades in at slide-right */}
      <div style={{ position: 'absolute', left: 220, top: 443, width: 591, overflow: 'hidden', zIndex: 10 }}>
        <span style={{ display: 'block', fontFamily: "'Jaini', serif", fontSize: 40, textAlign: 'right', color: 'rgb(189,163,113)', textShadow: '0 2px 1px rgba(0,0,0,.46)', opacity: textVisible ? 1 : 0, transition: 'opacity 4.5s ease-out 0.5s' }}>{fateCard.title}</span>
        <span style={{ display: 'block', marginTop: 8, fontFamily: "'Jaini', serif", fontSize: 24, lineHeight: 1.3, textAlign: 'right', color: 'rgb(189,163,113)', textShadow: '0 2px 1px rgba(0,0,0,.46)', opacity: textVisible ? 1 : 0, transition: 'opacity 4.5s ease-out 0.5s' }}>{fateCard.text}</span>
      </div>
      {/* Card */}
      <div style={wrapStyle}>
        <div style={{ position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d', transition: 'transform 0.9s cubic-bezier(0.4,0,0.2,1)', transform: flipT }}>
          <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', borderRadius: 13, overflow: 'hidden', boxShadow: '0 5px 4.8px 1px rgba(0,0,0,.5)', background: `url(${A('major-arcana-back.png')}) center / 100% 100% no-repeat, #0a0a0a` }} />
          <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderRadius: 13, overflow: 'hidden', boxShadow: '0 5px 4.8px 1px rgba(0,0,0,.5)', background: `url(${A('arcana-front.png')}) center / cover no-repeat, ${cardGrad}, #0a0a0a` }}>
            <span style={{ position: 'absolute', left: 68, top: 131, width: 215, fontFamily: "'Jaini', serif", fontSize: 24, lineHeight: 1, textAlign: 'center', color: 'rgba(255,255,255,.85)', textShadow: '0 3px 1px rgba(0,0,0,.46)' }}>{fateCard.title}</span>
            <div style={{ position: 'absolute', left: 74, top: 249, width: 203, height: 35, background: `url(${A('divider.png')}) center / contain no-repeat` }} />
            <span style={{ position: 'absolute', left: 46, top: 327, width: 261, fontFamily: "'Jaini', serif", fontSize: 16, lineHeight: 1.3, textAlign: 'center', color: 'rgba(255,255,255,.65)' }}>{fateCard.text}</span>
          </div>
        </div>
      </div>
    </>
  )
}

// ── CSS animation injection (once) ───────────────────────────────────────────
function useWWStyles() {
  useEffect(() => {
    if (document.getElementById('ww-styles')) return
    const s = document.createElement('style')
    s.id = 'ww-styles'
    s.textContent = `
      @keyframes wwIllusWipe {
        0%   { clip-path: inset(100% 0 0 0); opacity: 0; }
        8%   { opacity: 1; }
        100% { clip-path: inset(0 0 0 0); opacity: 1; }
      }
      @keyframes wwIllusWipeOut {
        0%   { clip-path: inset(0 0 0 0); opacity: 1; }
        80%  { opacity: 1; }
        100% { clip-path: inset(0 0 100% 0); opacity: 0; }
      }
      .ww-illus     { animation: wwIllusWipe    2.8s cubic-bezier(0.4,0,0.2,1) forwards; }
      .ww-illus-out { animation: wwIllusWipeOut 0.75s ease-in               forwards; }
    `
    document.head.appendChild(s)
  }, [])
}

// ── SCREEN 1 — Waiting room (pub === null, game not started) ─────────────────
// Matches design HTML Screen 1 exactly:
// - bg-night-deep.jpg
// - dec-corner-desat.png corners
// - "Waiting for players to join..." at (508, 309)
// - Player grid at (302, 415) — 100px avatar, green ring, no seat badge
// - NO bottom illustration
function LobbyBoard({ players }: { players: { id: string; nickname: string }[] }) {
  useWWStyles()
  return (
    <div style={{ width: 1440, height: 810, position: 'relative', overflow: 'hidden', fontFamily: "'Jaini', serif" }}>
      <div style={{ position: 'absolute', inset: 0, background: `url(${A('bg-night-deep.jpg')}) center / cover no-repeat`, zIndex: 0 }} />
      <CornerDecs />
      <ForegroundScale>
        <span style={{ position: 'absolute', left: 508, top: 309, width: 424, height: 53, fontFamily: "'Jaini', serif", fontSize: 40, lineHeight: '100%', textAlign: 'center', color: 'rgba(255,255,255,.85)', textShadow: '0 3px 1px rgba(0,0,0,.46)', zIndex: 2 }}>
          等待玩家加入...
        </span>
        <div style={{ position: 'absolute', left: 302, top: 415, width: 858, height: 334, display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start', rowGap: 34, columnGap: 0, zIndex: 3 }}>
          {players.map(p => <AvatarBubble key={p.id} nickname={p.nickname} alive={true} />)}
        </div>
      </ForegroundScale>
      {/* Screen 1 intentionally has no bottom illustration */}
    </div>
  )
}

// ── SCREENS 2-4 — Game board ─────────────────────────────────────────────────
function WerewolfBoard({ pub }: { pub: WerewolfPublicState }) {
  useWWStyles()
  const director  = useFateWerewolfDirector(pub)
  const isNight   = NIGHT_PHASES.has(pub.phase)
  const nightRole = pub.nightStep ? NIGHT_ROLE_INFO[pub.nightStep] : null
  const headline  = director.headline || ''
  const narration = director.narrationText || pub.directorMessage || ''
  const subtitle  = DAY_SUBTITLES[pub.phase] ?? ''
  const hasDayEventTitle = Boolean(!isNight && subtitle && subtitle !== headline)

  // Show player grid only during day phases (Screen 3/4 layout)
  // role-assignment: headline fills center, no grid overlap
  const showGrid = !(['role-assignment', 'night', 'fate-council', 'fate-card-reveal', 'fate-blessing'].includes(pub.phase))

  // Grid position: role-assignment uses lobby coords, day phases use day coords
  const gridLeft = pub.phase === 'role-assignment' ? 302 : 291
  const gridTop  = pub.phase === 'role-assignment' ? 415 : (hasDayEventTitle ? DAY_ACTIVE_CONTENT_TOP : DAY_ACTIVE_CONTENT_TOP - 56)

  // Arcana card animation
  const [cardStage, setCardStage] = useState<CardStage>('init')
  const arcanaStarted = useRef(false)
  useEffect(() => {
    if (pub.phase !== 'fate-card-reveal') { arcanaStarted.current = false; return }
    if (arcanaStarted.current) return
    arcanaStarted.current = true
    setCardStage('init')
    const t1 = setTimeout(() => setCardStage('center'),      300)
    const t2 = setTimeout(() => setCardStage('flip'),       6500)
    const t3 = setTimeout(() => setCardStage('slide-right'), 9300)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [pub.phase])

  // Victory illustration: wipe-out current illus, then wipe-in victory illus
  const [victoryPhase, setVictoryPhase] = useState<'idle' | 'out' | 'in'>('idle')
  const prevWinner = useRef<string | null>(null)
  useEffect(() => {
    const winner = pub.victory?.winner ?? null
    if (winner === prevWinner.current) return
    prevWinner.current = winner
    if (!winner) { setVictoryPhase('idle'); return }
    setVictoryPhase('out')
    const t = setTimeout(() => setVictoryPhase('in'), 800)
    return () => clearTimeout(t)
  }, [pub.victory?.winner])

  return (
    <div style={{ width: 1440, height: 810, position: 'relative', overflow: 'hidden', fontFamily: "'Jaini', serif" }}>

      {/* Background */}
      {isNight
        ? <div style={{ position: 'absolute', inset: 0, background: `url(${A('bg-night-deep.jpg')}) center / cover no-repeat`, zIndex: 0 }} />
        : <div style={{ position: 'absolute', inset: 0, background: `url(${A('bg-day.jpg')}) center / cover no-repeat`, filter: 'saturate(0.7) brightness(1.15)', zIndex: 0 }} />
      }

      <CornerDecs />
      {/* illus layers stay full-size */}
      {isNight && pub.phase !== 'role-assignment' && victoryPhase !== 'in' && (
        <Illus src={A('illus-night.png')} bgSize="center / contain" wipeOut={victoryPhase === 'out'} />
      )}
      {!isNight && victoryPhase !== 'in' && (
        <Illus src={A('illus-day.png')} bgSize="bottom center / 100% 188.5%" wipeOut={victoryPhase === 'out'} />
      )}

      <ForegroundScale>
        {/* ── SCREEN 2 — Night stage ─────────────────────────────── */}
        {isNight && pub.phase !== 'role-assignment' && (
          <>
            <div style={{ position: 'absolute', left: 464, top: 45, width: 506, height: 238, background: `url(${A('banner-top.png')}) center / contain no-repeat`, zIndex: 2 }} />
            <div style={{ position: 'absolute', left: 641, top: 70, width: 156, height: 128, background: `url(${A('moon-emblem.png')}) center / contain no-repeat`, zIndex: 2 }} />

            {headline && (
              <span style={{ position: 'absolute', left: 302, top: 376, width: 836, height: 126, fontFamily: "'Jaini', serif", fontSize: 96, lineHeight: '100%', textAlign: 'center', color: 'rgb(230,183,109)', textShadow: '0 3px 1px rgba(0,0,0,.46)', zIndex: 2 }}>
                {headline}
              </span>
            )}

            <div style={{ position: 'absolute', left: 596, top: 491, width: 247, height: 42, background: `url(${A('divider.png')}) center / contain no-repeat`, zIndex: 2 }} />

            {nightRole ? (
              <>
                <span style={{ position: 'absolute', left: 302, top: 546, width: 836, height: 42, fontFamily: "'Jaini', serif", fontSize: 32, lineHeight: '100%', textAlign: 'center', color: 'rgb(217,217,217)', textShadow: '0 3px 1px rgba(0,0,0,.46)', zIndex: 2 }}>
                  {nightRole.instruction}
                </span>
                <span style={{ position: 'absolute', left: 302, top: 594, width: 836, height: 84, fontFamily: "'Jaini', serif", fontSize: 64, lineHeight: '100%', textAlign: 'center', color: 'rgb(242,94,91)', textShadow: '0 3px 1px rgba(0,0,0,.46)', zIndex: 2 }}>
                  {nightRole.label}
                </span>
              </>
            ) : narration ? (
              <span style={{ position: 'absolute', left: 302, top: 546, width: 836, fontFamily: "'Jaini', serif", fontSize: 32, lineHeight: 1.4, textAlign: 'center', color: 'rgb(217,217,217)', textShadow: '0 3px 1px rgba(0,0,0,.46)', zIndex: 2 }}>
                {narration}
              </span>
            ) : null}
          </>
        )}

        {pub.phase === 'role-assignment' && (
          <>
            {headline && (
              <span style={{ position: 'absolute', left: 302, top: 376, width: 836, fontFamily: "'Jaini', serif", fontSize: 96, lineHeight: '100%', textAlign: 'center', color: 'rgb(230,183,109)', textShadow: '0 3px 1px rgba(0,0,0,.46)', zIndex: 2 }}>
                {headline}
              </span>
            )}
            <div style={{ position: 'absolute', left: 596, top: 491, width: 247, height: 42, background: `url(${A('divider.png')}) center / contain no-repeat`, zIndex: 2 }} />
            {narration && (
              <span style={{ position: 'absolute', left: 302, top: 546, width: 836, fontFamily: "'Jaini', serif", fontSize: 32, lineHeight: 1.4, textAlign: 'center', color: 'rgb(217,217,217)', textShadow: '0 3px 1px rgba(0,0,0,.46)', zIndex: 2 }}>
                {narration}
              </span>
            )}
          </>
        )}

        {!isNight && (
          <>
            <div style={{ position: 'absolute', left: 489, top: 51, width: 462, height: 218, overflow: 'hidden', zIndex: 2 }}>
              <div style={{ position: 'absolute', left: 0, top: 0, width: 462, height: 218, background: `url(${A('banner-top.png')}) center / cover no-repeat` }} />
              <div style={{ position: 'absolute', left: 162, top: 7, width: 142, height: 142, background: `url(${A('banner-emblem.png')}) center / contain no-repeat` }} />
            </div>

            <div style={{ position: 'absolute', left: 302, top: 213, width: 836, height: 126, zIndex: 2 }}>
              <span style={{ position: 'absolute', left: 0, top: 0, width: 836, height: 126, fontFamily: "'Jaini', serif", fontSize: 96, lineHeight: '100%', textAlign: 'center', color: 'rgb(153,132,99)', textShadow: '0 3px 1px rgba(0,0,0,.46)' }}>
                {headline}
              </span>
            </div>

            {hasDayEventTitle && (
              <span style={{ position: 'absolute', left: 302, top: DAY_EVENT_TOP + 213, width: 836, height: 42, fontFamily: "'Jaini', serif", fontSize: 32, lineHeight: '100%', textAlign: 'center', color: 'rgb(186,151,96)', textShadow: '0 3px 1px rgba(0,0,0,.46)', zIndex: 2 }}>
                {subtitle}
              </span>
            )}

            <div style={{ position: 'absolute', left: 596, top: hasDayEventTitle ? DAY_DIVIDER_TOP : DAY_DIVIDER_TOP - 56, width: 247, height: 42, background: `url(${A('divider.png')}) center / contain no-repeat`, zIndex: 2 }} />

            {pub.phase !== 'fate-card-reveal' && narration && (
              <span style={{ position: 'absolute', left: 302, top: hasDayEventTitle ? DAY_NARRATION_TOP : DAY_NARRATION_TOP - 56, width: 836, fontFamily: "'Jaini', serif", fontSize: 26, lineHeight: 1.4, textAlign: 'center', color: 'rgb(186,151,96)', textShadow: '0 2px 1px rgba(0,0,0,.3)', zIndex: 2 }}>
                {narration}
              </span>
            )}

            {pub.phase === 'fate-card-reveal' && pub.fateCard && (
              <ArcanaCard fateCard={pub.fateCard} cardStage={cardStage} />
            )}
          </>
        )}

        {showGrid && (
          <div style={{ position: 'absolute', left: gridLeft, top: gridTop, width: 858, height: 334, display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start', rowGap: 34, columnGap: 0, zIndex: 3 }}>
            {pub.seats.map(seat => (
              <AvatarBubble
                key={seat.id}
                nickname={seat.nickname}
                alive={seat.alive}
                isSpeaking={seat.isSpeaking || seat.isActiveStep}
              />
            ))}
          </div>
        )}
      </ForegroundScale>

      {/* ── Victory overlay — shows after wipe-out completes ────── */}
      {pub.victory && victoryPhase === 'in' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 20 }}>
          {/* Dark background */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.72)' }} />
          <ForegroundScale zIndex={21}>
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 417, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
              <div style={{ fontFamily: "'Jaini', serif", fontSize: 80, lineHeight: '100%', textAlign: 'center', color: 'rgb(230,183,109)', textShadow: '0 3px 1px rgba(0,0,0,.46)' }}>{pub.victory.title}</div>
              <div style={{ fontFamily: "'Jaini', serif", fontSize: 36, lineHeight: '100%', textAlign: 'center', color: 'rgba(255,255,255,.75)', textShadow: '0 2px 1px rgba(0,0,0,.46)' }}>{pub.victory.body}</div>
            </div>
          </ForegroundScale>
          {/* Victory illustration wipes in from bottom */}
          <div className="ww-illus" style={{ position: 'absolute', left: getBottomIllustrationLayout().left, bottom: getBottomIllustrationLayout().bottom, width: getBottomIllustrationLayout().width, height: getBottomIllustrationLayout().height, background: `url(${VICTORY_ILLUS[pub.victory.winner] ?? ''}) center / cover no-repeat`, pointerEvents: 'none' }} />
        </div>
      )}
    </div>
  )
}

// ── Scaled to any viewport ────────────────────────────────────────────────────
function ScaledBoard({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState({ scale: 1, top: 0, left: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => {
      const { width: W, height: H } = entry.contentRect
      const safePad = 16
      const scale = Math.min((W - safePad * 2) / 1440, (H - safePad * 2) / 810)
      setFit({
        scale,
        top: (H - 810 * scale) / 2,
        left: (W - 1440 * scale) / 2,
      })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ position: 'fixed', top: 52, left: 0, right: 0, bottom: 0, background: '#211c18', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 1440, height: 810, transform: `scale(${fit.scale})`, transformOrigin: 'top left', top: fit.top, left: fit.left }}>
        {children}
      </div>
    </div>
  )
}

// ── Floating test panel (bottom-left, game only) ─────────────────────────────
const PHASE_ZH: Record<string, string> = {
  'role-assignment':'角色分配','first-night-setup':'首夜','night':'夜晚',
  'fate-council':'命运议会','fate-card-reveal':'命运揭晓','fate-blessing':'命运赐福',
  'night-results':'昨夜结果','discussion-r1':'第一轮发言','discussion-r2':'自由发言',
  'voting':'投票','pk-discussion':'PK辩护','pk-voting':'PK投票',
  'execution':'放逐','victory-check':'胜负判定','complete':'结束',
}
const STEP_ZH: Record<string, string> = {
  'guardian-action':'守护者','wolf-action':'狼人','fate-weaver-action':'命运编织者','oracle-action':'神谕者',
}
const ROLE_ICON: Record<string, string> = {
  werewolf:'🐺', villager:'👤', guardian:'🛡', oracle:'🔮',
  witch:'🧙', hunter:'🏹', cupid:'💘', arsonist:'🔥', piper:'🎵', fateweaver:'🃏',
}

type PSel = { targetId: string; cardId: string; option: string; tendency: string }

// Per-player inline action controls
function PlayerActionRow({
  seat, priv, sel, setSel, onSubmit, busy,
}: {
  seat: { id: string; seatNumber: number; nickname: string; alive: boolean }
  priv: WerewolfPrivateState | undefined
  sel: PSel
  setSel: (patch: Partial<PSel>) => void
  onSubmit: (playerId: string, payload: Record<string, string>) => Promise<void>
  busy: boolean
}) {
  const action = priv?.action
  const roleId = priv?.role?.id ?? ''
  const roleName = priv?.role?.name ?? ''
  const icon = ROLE_ICON[roleId] ?? '❓'

  const hasPending = action && !action.disabled
  const isDone     = action?.disabled

  const rowBg = !seat.alive ? 'rgba(255,255,255,.04)' : hasPending ? 'rgba(42,110,58,.15)' : 'rgba(255,255,255,.06)'
  const borderColor = !seat.alive ? '#222' : hasPending ? '#2a6e3a' : '#2a2a2a'

  async function submit() {
    if (!action) return
    await onSubmit(seat.id, {
      type: ('actionId' in action ? action.actionId : undefined) ?? action.type,
      targetId: sel.targetId || action.selectedTargetId || '',
      option: sel.option || 'kill',
      tendency: sel.tendency || action.selectedTendency || '',
      cardId: sel.cardId || ('selectedCardId' in action ? action.selectedCardId : '') || 'skip',
    })
  }

  const selectStyle: React.CSSProperties = {
    background: '#1a1a2e', color: '#e0d8c8', border: '1px solid #444',
    borderRadius: 4, padding: '4px 6px', fontSize: 12, cursor: 'pointer', flex: 1,
  }
  const smallBtn = (label: string, onClick: () => void, active?: boolean): React.ReactElement => (
    <button onClick={onClick} disabled={busy} style={{
      padding: '4px 10px', borderRadius: 4, border: `1px solid ${active ? '#bda371' : '#444'}`,
      background: active ? 'rgba(189,163,113,.2)' : 'transparent',
      color: active ? '#bda371' : '#888', fontSize: 12, cursor: 'pointer',
    }}>{label}</button>
  )

  return (
    <div style={{ background: rowBg, border: `1px solid ${borderColor}`, borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 13, color: '#bda371', fontWeight: 700, minWidth: 22 }}>#{seat.seatNumber}</span>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 13, color: seat.alive ? '#e0d8c8' : '#555', flex: 1 }}>{seat.nickname}</span>
        {roleName && <span style={{ fontSize: 11, color: '#f25e5b' }}>{roleName}</span>}
        {!seat.alive && <span style={{ fontSize: 11, color: '#444' }}>💀</span>}
        {isDone && <span style={{ fontSize: 11, color: '#6f6' }}>✓</span>}
        {!seat.alive && <a href={`/game/fate-werewolf/${seat.id.slice(0,4)}/phone?pid=${seat.id}`} style={{ fontSize: 11, color: '#444' }}>📱</a>}
      </div>

      {/* Action controls */}
      {hasPending && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4, borderTop: '1px solid #2a2a2a' }}>
          {/* Target selector */}
          {action.targets && action.targets.length > 0 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap' }}>目标</span>
              <select value={sel.targetId || action.selectedTargetId || ''} onChange={e => setSel({ targetId: e.target.value })} style={selectStyle}>
                <option value="">— 选择 —</option>
                {action.targets.map(t => <option key={t.id} value={t.id}>{t.nickname}</option>)}
              </select>
            </div>
          )}
          {/* Wolf options */}
          {action.wolfOptions && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {action.wolfOptions.map(o => smallBtn(o.label, () => setSel({ option: o.id }), (sel.option || 'kill') === o.id))}
            </div>
          )}
          {/* Tendencies */}
          {action.tendencies && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {action.tendencies.map(t => smallBtn(t.title, () => setSel({ tendency: t.id }), sel.tendency === t.id))}
            </div>
          )}
          {/* Cards */}
          {action.cards && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {action.cards.map(c => smallBtn(c.label, () => setSel({ cardId: c.id }), sel.cardId === c.id))}
            </div>
          )}
          {/* Submit */}
          <button onClick={submit} disabled={busy} style={{
            padding: '5px 12px', borderRadius: 5, border: 'none',
            background: busy ? '#333' : '#2a6e3a', color: '#fff',
            fontSize: 12, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', alignSelf: 'flex-end',
          }}>提交</button>
        </div>
      )}
    </div>
  )
}

function FloatingTestPanel({ code, pub }: { code: string; pub: WerewolfPublicState }) {
  const [open,       setOpen]       = useState(false)
  const [privates,   setPrivates]   = useState<Record<string, WerewolfPrivateState>>({})
  const [selections, setSelections] = useState<Record<string, PSel>>({})
  const [busy,       setBusy]       = useState(false)
  const [log,        setLog]        = useState('')
  const phase = PHASE_ZH[pub.phase] ?? pub.phase
  const step  = pub.nightStep ? ` · ${STEP_ZH[pub.nightStep] ?? pub.nightStep}` : ''

  const fetchPrivates = useCallback(async () => {
    const entries = await Promise.all(
      pub.seats.map(async s => {
        try {
          const r = await fetch(`/api/rooms/${code}/werewolf/private/${s.id}`)
          const d = await r.json() as { privateState?: WerewolfPrivateState }
          return [s.id, d.privateState] as const
        } catch { return [s.id, undefined] as const }
      })
    )
    setPrivates(Object.fromEntries(entries.filter(([, v]) => v) as [string, WerewolfPrivateState][]))
  }, [code, pub.seats, pub.phase, pub.nightStep])

  useEffect(() => { if (open) void fetchPrivates() }, [open, fetchPrivates])

  function sel(id: string): PSel { return selections[id] ?? { targetId: '', cardId: '', option: 'kill', tendency: '' } }
  function setSel(id: string, patch: Partial<PSel>) {
    setSelections(prev => ({ ...prev, [id]: { ...sel(id), ...patch } }))
  }

  async function bulkCall(label: string, path: string) {
    if (busy) return
    setBusy(true)
    try {
      const res  = await fetch(`/api/rooms/${code}${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devWerewolf: true }),
      })
      const data = await res.json() as { phase?: string; error?: string }
      setLog(data.error ? `❌ ${label}` : `✅ ${label}${data.phase ? ' → ' + (PHASE_ZH[data.phase] ?? data.phase) : ''}`)
      await fetchPrivates()
    } catch { setLog(`❌ ${label} 失败`) }
    finally { setBusy(false) }
  }

  async function submitAction(playerId: string, payload: Record<string, string>) {
    if (busy) return
    setBusy(true)
    try {
      const res  = await fetch(`/api/rooms/${code}/werewolf/action`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, ...payload }),
      })
      const data = await res.json() as { privateState?: WerewolfPrivateState; error?: string }
      if (data.error) { setLog(`❌ 操作失败: ${data.error}`); return }
      setLog(`✅ #${pub.seats.find(s => s.id === playerId)?.seatNumber} 已提交`)
      if (data.privateState) setPrivates(prev => ({ ...prev, [playerId]: data.privateState! }))
      // Re-fetch all to pick up phase advance
      await fetchPrivates()
    } catch { setLog('❌ 提交失败') }
    finally { setBusy(false) }
  }

  const bulkBtn = (label: string, path: string, color: string) => (
    <button onClick={() => bulkCall(label, path)} disabled={busy} style={{
      padding: '7px 12px', borderRadius: 6, border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
      background: color, color: '#fff', fontSize: 12, fontWeight: 600, opacity: busy ? 0.5 : 1, flex: 1,
    }}>{label}</button>
  )

  return (
    <div style={{ position: 'fixed', left: 16, bottom: 16, zIndex: 9999, fontFamily: 'system-ui, sans-serif' }}>
      {open && (
        <div style={{
          background: 'rgba(8,8,16,.97)', border: '1px solid #2a2a2a', borderRadius: 12,
          padding: 14, marginBottom: 8, width: 420,
          maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
          boxShadow: '0 12px 40px rgba(0,0,0,.8)',
        }}>
          {/* Phase header */}
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#f25e5b', fontWeight: 700 }}>开发模式 · {phase}{step}</span>
            <button onClick={fetchPrivates} style={{ marginLeft: 'auto', fontSize: 11, color: '#555', background: 'none', border: 'none', cursor: 'pointer' }}>↻ 刷新</button>
          </div>

          {/* Bulk controls */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {bulkBtn('⚡ 自动填充并推进', '/werewolf/test/auto', '#2a6e3a')}
            {bulkBtn('▶ 强制推进', '/werewolf/next', '#1a4a8a')}
            {bulkBtn('↺ 重启', '/werewolf/restart', '#6a1a1a')}
          </div>

          {/* Per-player action rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pub.seats.map(seat => (
              <PlayerActionRow
                key={seat.id}
                seat={seat}
                priv={privates[seat.id]}
                sel={sel(seat.id)}
                setSel={patch => setSel(seat.id, patch)}
                onSubmit={submitAction}
                busy={busy}
              />
            ))}
          </div>

          {/* Log */}
          {log && (
            <div style={{ marginTop: 10, padding: '6px 8px', borderRadius: 4, background: 'rgba(0,0,0,.4)', fontSize: 12, color: log.startsWith('✅') ? '#6f6' : '#f66', fontFamily: 'monospace' }}>
              {log}
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: 44, height: 44, borderRadius: '50%', border: '1px solid #333', background: 'rgba(8,8,16,.9)', color: '#bda371', fontSize: 20, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,.5)' }}
        title="测试面板"
      >{open ? '✕' : '🔧'}</button>
    </div>
  )
}

// ── Entry point ───────────────────────────────────────────────────────────────
export interface FateWerewolfBigScreenProps {
  /** Runtime props are supplied by Joyly; route params remain a direct-link fallback. */
  room?: Room
  code?: string
}

export default function FateWerewolfBigScreen(props: FateWerewolfBigScreenProps = {}) {
  const { code: routeCode } = useParams<{ code: string }>()
  const code = props.code ?? routeCode
  const storedRoom = useRoomStore(s => s.room)
  const room = storedRoom ?? props.room ?? null
  const pub  = room?.gameState as WerewolfPublicState | null

  if (!pub) {
    const players = room
      ? room.players.map(p => ({ id: p.id, nickname: p.nickname }))
      : []
    return <ScaledBoard><LobbyBoard players={players} /></ScaledBoard>
  }

  return (
    <>
      <ScaledBoard><WerewolfBoard pub={pub} /></ScaledBoard>
      {code && canRenderDevWerewolfPanel(window.location.search) && <FloatingTestPanel code={code} pub={pub} />}
    </>
  )
}

/** Development controls intentionally require an explicit opt-in query flag. */
export function shouldRenderDevWerewolfPanel(search: string) {
  return new URLSearchParams(search).get('devWerewolf') === '1'
}

export function canRenderDevWerewolfPanel(search: string) {
  return shouldRenderDevWerewolfPanel(search)
}
