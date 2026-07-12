export const FATE_TENDENCIES = Object.freeze(['omen', 'shelter', 'chaos', 'dark'])

export const PLACEHOLDER_FATE_CARDS = Object.freeze([
  { id: 'minor-omen', arcanaType: 'minor', tendency: 'omen', tendencyLabel: '神谕', title: '审判之眼', text: '小阿尔克那占位牌：具体效果尚未定义。', trigger: null, effectKey: 'placeholder' },
  { id: 'minor-shelter', arcanaType: 'minor', tendency: 'shelter', tendencyLabel: '守护', title: '庇护之盾', text: '小阿尔克那占位牌：具体效果尚未定义。', trigger: null, effectKey: 'placeholder' },
  { id: 'minor-chaos', arcanaType: 'minor', tendency: 'chaos', tendencyLabel: '混乱', title: '命运逆转', text: '小阿尔克那占位牌：具体效果尚未定义。', trigger: null, effectKey: 'placeholder' },
  { id: 'minor-dark', arcanaType: 'minor', tendency: 'dark', tendencyLabel: '黑暗', title: '黑暗契约', text: '小阿尔克那占位牌：具体效果尚未定义。', trigger: null, effectKey: 'placeholder' },
  { id: 'major-first-wolf-death', arcanaType: 'major', tendency: 'omen', tendencyLabel: '神谕', title: '高塔', text: '大阿尔克那占位牌：具体效果尚未定义。', trigger: 'first-wolf-death', effectKey: 'placeholder' },
  { id: 'major-endgame', arcanaType: 'major', tendency: 'dark', tendencyLabel: '黑暗', title: '死神', text: '大阿尔克那占位牌：具体效果尚未定义。', trigger: 'endgame', effectKey: 'placeholder' },
  { id: 'major-two-peaceful-nights', arcanaType: 'major', tendency: 'shelter', tendencyLabel: '守护', title: '节制', text: '大阿尔克那占位牌：具体效果尚未定义。', trigger: 'two-peaceful-nights', effectKey: 'placeholder' },
])

/**
 * Selects a card after the council is finalized. Every candidate has one base
 * ticket, plus one ticket for each council vote matching its tendency.
 */
export function drawFateCard({ votes = {}, triggers = [], random = Math.random } = {}) {
  const activeTriggers = new Set(triggers)
  const candidates = PLACEHOLDER_FATE_CARDS.filter(card => card.arcanaType === 'minor' || activeTriggers.has(card.trigger))
  const voteWeights = Object.values(votes).reduce((weights, tendency) => {
    if (FATE_TENDENCIES.includes(tendency)) weights[tendency] = (weights[tendency] ?? 0) + 1
    return weights
  }, {})
  const totalWeight = candidates.reduce((sum, card) => sum + 1 + (voteWeights[card.tendency] ?? 0), 0)
  let ticket = Math.min(Math.max(Number(random()) || 0, 0), 0.999999999999) * totalWeight
  for (const card of candidates) {
    ticket -= 1 + (voteWeights[card.tendency] ?? 0)
    if (ticket < 0) return { ...card }
  }
  return { ...candidates[candidates.length - 1] }
}
