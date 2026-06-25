import { useEffect, useRef, useState } from 'react'
import type { WerewolfPublicState, TopAsset, BotAsset } from '../../shared/types'
import { resolveCue } from '../lib/cue-map'

export interface WerewolfDirectorState {
  topAsset: TopAsset
  botAsset: BotAsset
  headline: string
  /** Director guidance text, displayed prominently on the big screen. No audio. */
  narrationText: string
}

export function useFateWerewolfDirector(
  publicState: WerewolfPublicState | null
): WerewolfDirectorState {
  const [topAsset, setTopAsset]       = useState<TopAsset>(null)
  const [botAsset, setBotAsset]       = useState<BotAsset>(null)
  const [headline, setHeadline]       = useState('')
  const [narrationText, setNarration] = useState('')

  const prevPhaseRef = useRef<string | null>(null)
  const prevStepRef  = useRef<string | null>(null)

  useEffect(() => {
    if (!publicState) return
    const { phase, nightStep, round, speakerNickname, nightDeaths, fateCard, executedPlayerId, victory } = publicState

    if (phase === prevPhaseRef.current && nightStep === prevStepRef.current) return
    prevPhaseRef.current = phase
    prevStepRef.current  = nightStep

    const cue = resolveCue(phase, nightStep, {
      round,
      speaker: speakerNickname ?? '',
      deaths: nightDeaths.join('、'),
      cardName: fateCard?.title ?? '',
      cardEffect: fateCard?.text ?? '',
      executed: executedPlayerId ?? '',
      winner: victory?.winner ?? '',
    })

    setTopAsset(cue.topAsset)
    setBotAsset(cue.botAsset)
    setHeadline(cue.headline)
    setNarration(cue.narration)
  }, [publicState?.phase, publicState?.nightStep, publicState?.round])

  return { topAsset, botAsset, headline, narrationText }
}
