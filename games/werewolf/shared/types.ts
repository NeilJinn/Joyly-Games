export type WerewolfPhase =
  | 'lobby'
  | 'role-assignment'
  | 'first-night-setup'
  | 'night'
  | 'fate-council'
  | 'fate-card-reveal'
  | 'fate-blessing'
  | 'night-results'
  | 'discussion-r1'
  | 'discussion-r2'
  | 'voting'
  | 'pk-discussion'
  | 'pk-voting'
  | 'execution'
  | 'victory-check'
  | 'complete'

export type NightStep =
  | 'guardian-action'
  | 'wolf-action'
  | 'fate-weaver-action'
  | 'oracle-action'
  | 'pyromaniac-action'
  | 'dream-messenger-action'
  | 'dream-reveal'

export type WerewolfFateArcanaType = 'minor' | 'major'
export type WerewolfFateTendencyId = 'omen' | 'shelter' | 'chaos' | 'dark'
/**
 * Placeholder effects deliberately have one explicit no-op key. New card effects
 * must be added here before a resolver is allowed to execute them.
 */
export type WerewolfFateEffectKey = 'placeholder'

export type TimeOfDay = 'day' | 'night'
export type TopAsset = 'moon-icon' | 'sun-banner' | null
export type BotAsset = 'werewolf-stage' | 'daytime-illus' | null

export interface WerewolfSeat {
  id: string
  nickname: string
  alive: boolean
  seatNumber: number
  isSpeaking: boolean
  isActiveStep: boolean
}

export interface WerewolfFateCard {
  id: string
  /** `minor` cards are drawn every round; `major` cards require a trigger. */
  arcanaType?: WerewolfFateArcanaType
  title: string
  text: string
  tendency: WerewolfFateTendencyId
  tendencyLabel: string
  /** Stable trigger identifier; concrete trigger handling lives on the server. */
  trigger?: string
  /** Placeholder cards are recorded as handled without changing game rules. */
  effectKey?: WerewolfFateEffectKey
  resolved?: boolean
}

/** Public audit record only; it intentionally contains no votes or player data. */
export interface WerewolfFateHistoryRecord {
  round: number
  cardId: string
  arcanaType: WerewolfFateArcanaType
  tendency: WerewolfFateTendencyId
  processed: boolean
  processedAt: number
  effectKey: WerewolfFateEffectKey
}

/** Public replay records deliberately exclude roles, private actions, and individual ballots. */
export interface WerewolfNightHistoryRecord { round: number; deaths: string[] }
export interface WerewolfVoteHistoryRecord { round: number; kind: 'vote' | 'pk'; cast: number; expected: number; outcome: string | null }
export interface WerewolfExecutionHistoryRecord { round: number; playerId: string | null }

export interface WerewolfVictory {
  winner: string
  title: string
  body: string
}

export interface WerewolfPublicState {
  phase: WerewolfPhase
  nightStep: NightStep | null
  timeOfDay: TimeOfDay
  round: number
  seats: WerewolfSeat[]
  nightDeaths: string[]
  fateCard: WerewolfFateCard | null
  fateHistory: WerewolfFateHistoryRecord[]
  nightHistory: WerewolfNightHistoryRecord[]
  voteHistory: WerewolfVoteHistoryRecord[]
  executionHistory: WerewolfExecutionHistoryRecord[]
  speakerNickname: string | null
  voteProgress: { cast: number; expected: number } | null
  pkCandidates: string[]
  executedPlayerId: string | null
  victory: WerewolfVictory | null
  headline: string
  directorMessage: string
  deadVoteCount: number
  expectedDeadVoteCount: number
  acknowledgedCount: number
  expectedAcknowledgedCount: number
}

export interface WerewolfRoleDefinition {
  id: string
  name: string
  team: string
  cardTitle: string
  summary: string
  accent: string
}

export interface WerewolfActionTarget {
  id: string
  nickname: string
  /** Present for the arsonist action so previously marked targets can be rendered. */
  marked?: boolean
}

export interface WerewolfFateTendency {
  id: WerewolfFateTendencyId
  label: string
  title: string
}

export interface WerewolfTarotCard {
  id: string
  label: string
  used: boolean
}

/** Action-local cards are not the same as a player's persistent tarot inventory. */
export interface WerewolfActionCard {
  id: string
  label: string
  requiresTarget?: boolean
}

export type WerewolfAction =
  | { type: 'confirm-role'; label: string; disabled?: boolean }
  | { type: 'oracle-confirm'; label: string; disabled?: boolean }
  | { type: 'select-target'; actionId: 'guardian-protect' | 'vote-target' | 'pk-vote' | 'hunter-revenge' | 'arsonist-mark'; label: string; targets: WerewolfActionTarget[]; selectedTargetId?: string; allowSkip?: boolean; disabled?: boolean }
  | { type: 'wolf-night-action'; label: string; targets: WerewolfActionTarget[]; wolfOptions: { id: string; label: string }[]; selectedTargetId?: string; selectedOption?: string; disabled?: boolean }
  | { type: 'card-and-target'; actionId: 'fate-weaver-card'; label: string; cards: WerewolfActionCard[]; targets: WerewolfActionTarget[]; selectedCardId?: string; selectedTargetId?: string; wolfTargetName?: string | null; disabled?: boolean }
  | { type: 'multi-target'; actionId: 'cupid-bind'; label: string; targets: WerewolfActionTarget[]; requiredTargetCount: number; selectedTargetIds?: string[]; disabled?: boolean }
  | { type: 'fate-vote'; label: string; tendencies: WerewolfFateTendency[]; selectedTendency?: string; disabled?: boolean }
  | { type: 'discussion-opt-in'; label: string; selected?: boolean; disabled?: boolean }

export interface WerewolfPrivateState {
  playerId: string
  nickname: string
  alive: boolean
  phase: WerewolfPhase
  role: WerewolfRoleDefinition
  team: string
  wolfAllies: WerewolfActionTarget[]
  oracleMessage: string | null
  privateBlessing: string
  tarotCards: WerewolfTarotCard[]
  action: WerewolfAction | null
  promptTitle: string
  promptBody: string
}
