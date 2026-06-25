import type { TopAsset, BotAsset } from '../../shared/types'

export interface WerewolfCue {
  /** Displayed on the big screen as the director's visible "voice". No audio. */
  narration: string
  topAsset: TopAsset
  botAsset: BotAsset
  headline: string
}

type CueMap = Record<string, Record<string, WerewolfCue>>

export const WEREWOLF_CUE_MAP: CueMap = {
  'lobby': {
    _: { narration: '欢迎来到命运狼人，等待所有玩家加入...', topAsset: null, botAsset: null, headline: '命运狼人' },
  },
  'role-assignment': {
    _: { narration: '角色已分配，请悄悄查看你的手机，了解自己的身份。', topAsset: null, botAsset: null, headline: '角色分配' },
  },
  'first-night-setup': {
    _: { narration: '第一个夜晚悄然而至... 丘比特，请睁眼。', topAsset: 'moon-icon', botAsset: 'werewolf-stage', headline: '第一夜' },
  },
  'night': {
    'guardian-action':    { narration: '守护者，请睁开眼睛，选择今晚守护的玩家。', topAsset: 'moon-icon', botAsset: 'werewolf-stage', headline: '第{round}夜' },
    'wolf-action':        { narration: '狼人，请睁眼，确认同伴，决定今晚的行动。', topAsset: 'moon-icon', botAsset: 'werewolf-stage', headline: '第{round}夜' },
    'fate-weaver-action': { narration: '命运编织者，{target}今晚遭受袭击，是否使用卡牌？', topAsset: 'moon-icon', botAsset: 'werewolf-stage', headline: '第{round}夜' },
    'oracle-action':      { narration: '神谕者请睁眼，今晚的神谕已送达你的手机。', topAsset: 'moon-icon', botAsset: 'werewolf-stage', headline: '第{round}夜' },
  },
  'fate-council': {
    _: { narration: '命运议会开始，死亡的玩家，请在手机上投出你的选择。', topAsset: 'moon-icon', botAsset: 'werewolf-stage', headline: '命运议会' },
  },
  'fate-card-reveal': {
    _: { narration: '天色渐明。命运翻开了它的牌——{cardName}。{cardEffect}', topAsset: 'sun-banner', botAsset: 'daytime-illus', headline: '命运揭晓' },
  },
  'fate-blessing': {
    _: { narration: '命运眷顾了一位玩家，一张赐福已悄悄送出。', topAsset: 'sun-banner', botAsset: 'daytime-illus', headline: '命运赐福' },
  },
  'night-results': {
    _: { narration: '{deathsMessage}', topAsset: 'sun-banner', botAsset: 'daytime-illus', headline: '第{round}天' },
  },
  'discussion-r1': {
    _: { narration: '现在开始第一轮发言，请{speaker}发言。', topAsset: 'sun-banner', botAsset: 'daytime-illus', headline: '第{round}天 · 发言' },
  },
  'discussion-r2': {
    _: { narration: '进入第二轮自愿发言，有意发言的玩家请举手。', topAsset: 'sun-banner', botAsset: 'daytime-illus', headline: '第{round}天 · 补充发言' },
  },
  'voting': {
    _: { narration: '投票开始，请在手机上选出你认为最可疑的玩家。', topAsset: 'sun-banner', botAsset: 'daytime-illus', headline: '投票' },
  },
  'pk-discussion': {
    _: { narration: '出现平票，平票玩家请做最终辩护。', topAsset: 'sun-banner', botAsset: 'daytime-illus', headline: 'PK · 最终辩护' },
  },
  'pk-voting': {
    _: { narration: '其他存活玩家，请重新对平票候选人进行投票。', topAsset: 'sun-banner', botAsset: 'daytime-illus', headline: 'PK · 投票' },
  },
  'execution': {
    _: { narration: '{executed}被放逐了。猎人：{executed}，你有权带走一个人。', topAsset: 'sun-banner', botAsset: 'daytime-illus', headline: '放逐' },
  },
  'victory-check': {
    _: { narration: '', topAsset: 'sun-banner', botAsset: 'daytime-illus', headline: '胜负判定' },
  },
  'complete': {
    _: { narration: '{winner}获得了最终的胜利！', topAsset: null, botAsset: null, headline: '游戏结束' },
  },
}

const EMPTY_CUE: WerewolfCue = { narration: '', topAsset: null, botAsset: null, headline: '' }

export function resolveCue(
  phase: string,
  nightStep: string | null,
  context: {
    round?: number
    target?: string
    cardName?: string
    cardEffect?: string
    deaths?: string
    speaker?: string
    executed?: string
    winner?: string
  } = {}
): WerewolfCue {
  const steps = WEREWOLF_CUE_MAP[phase]
  if (!steps) return EMPTY_CUE

  const raw = steps[nightStep ?? '_'] ?? steps['_'] ?? EMPTY_CUE

  const deathsMessage = context.deaths
    ? `昨夜，${context.deaths}离开了这个世界。`
    : '昨夜，平安无事。'

  const fill = (s: string) =>
    s
      .replace('{round}', String(context.round ?? 1))
      .replace('{target}', context.target ?? '目标玩家')
      .replace('{cardName}', context.cardName ?? '')
      .replace('{cardEffect}', context.cardEffect ?? '')
      .replace('{deathsMessage}', deathsMessage)
      .replace('{speaker}', context.speaker ?? '')
      .replace('{executed}', context.executed ?? '')
      .replace('{winner}', context.winner ?? '')

  return { ...raw, narration: fill(raw.narration), headline: fill(raw.headline) }
}
