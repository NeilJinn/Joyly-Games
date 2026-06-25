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
  title: string
  text: string
  tendency: string
  tendencyLabel: string
}

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
}

export interface WerewolfFateTendency {
  id: string
  label: string
  title: string
}

export interface WerewolfTarotCard {
  id: string
  label: string
  used: boolean
}

export interface WerewolfAction {
  type: string
  label: string
  disabled?: boolean
  targets?: WerewolfActionTarget[]
  selectedTargetId?: string
  tendencies?: WerewolfFateTendency[]
  selectedTendency?: string
  cards?: WerewolfTarotCard[]
  wolfOptions?: { id: string; label: string }[]
  selectedOption?: string
}

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
