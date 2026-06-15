import { pickVariant } from "../../../shared/director/flow.js";
import {
  CUE_VARIANTS,
  DIRECTOR_CUES,
  DIRECTOR_CUE_REGISTRY
} from "./cue-library.generated.js";

const CUES_BY_KEY = new Map(DIRECTOR_CUES.map(cue => [cue.cueKey, cue]));

function canonicalCueKey(cueKey = "") {
  return cueKey;
}

function domainDefaultKey(cueKey = "") {
  const canonical = canonicalCueKey(cueKey);
  const cue = CUES_BY_KEY.get(canonical);
  const [scope, domain] = cue
    ? [cue.scope, cue.domain]
    : String(canonical).split(".");
  if (scope === "phase") {
    if (domain === "answering") return "phase.answering.answer.open";
    if (domain === "reveal") return "phase.reveal.answer.positive";
    if (domain === "scoring") return "phase.scoring.score.update";
    if (domain === "between-questions") return "phase.between-questions.transition.next";
  }
  if (scope === "global") return "global.game.default";
  if (scope === "cross" && domain) {
    const eventPath = cue?.eventPath || String(canonical).split(".").slice(2);
    return `global.${domain}.${eventPath.join(".")}`;
  }
  return null;
}

function fallbackKeys(cueKey = "") {
  const canonical = canonicalCueKey(cueKey);
  const cue = CUES_BY_KEY.get(canonical);
  const policyFallbacks = Array.isArray(cue?.policy?.fallback) ? cue.policy.fallback : [];
  return [
    canonical,
    ...policyFallbacks.map(canonicalCueKey),
    domainDefaultKey(canonical),
    "global.game.default"
  ].filter(Boolean);
}

export function getCue(cueKey = "") {
  return CUES_BY_KEY.get(canonicalCueKey(cueKey)) || null;
}

export function resolveCue(cueKey = "") {
  for (const key of fallbackKeys(cueKey)) {
    const canonical = canonicalCueKey(key);
    const variants = CUE_VARIANTS[canonical] || [];
    if (variants.length) {
      return {
        cue: CUES_BY_KEY.get(canonical) || null,
        cueKey: canonical,
        variants
      };
    }
  }
  return {
    cue: CUES_BY_KEY.get(canonicalCueKey(cueKey)) || null,
    cueKey: canonicalCueKey(cueKey),
    variants: []
  };
}

export function getCueVariants(cueKey = "") {
  return resolveCue(cueKey).variants;
}

export function pickCueVariant(cueKey = "", seed = "") {
  return pickVariant(getCueVariants(cueKey), seed);
}

export function hasCueVariants(cueKey = "") {
  return getCueVariants(cueKey).length > 0;
}

export function getTriggeredCues({
  triggerMode = "",
  phase = "",
  eventKey = "",
  scope = "",
  domain = ""
} = {}) {
  return DIRECTOR_CUES
    .filter(cue => {
      const trigger = cue.trigger || {};
      if (trigger.enabled === false) return false;
      if (triggerMode && trigger.mode !== triggerMode) return false;
      if (phase && trigger.phase && trigger.phase !== phase) return false;
      if (eventKey && trigger.eventKey && trigger.eventKey !== eventKey) return false;
      if (scope && cue.scope !== scope) return false;
      if (domain && cue.domain !== domain) return false;
      return true;
    })
    .sort((left, right) => {
      const leftPriority = Number(left.trigger?.priority ?? 100);
      const rightPriority = Number(right.trigger?.priority ?? 100);
      return leftPriority - rightPriority || left.cueKey.localeCompare(right.cueKey);
    });
}

export function getPhaseEntryCues(phase = "") {
  return getTriggeredCues({
    triggerMode: "phase-entry",
    phase,
    scope: "phase",
    domain: phase
  });
}

export const FALLBACK_ORDER = DIRECTOR_CUE_REGISTRY.defaults?.fallbackOrder || [];
export { CUE_VARIANTS, DIRECTOR_CUES, DIRECTOR_CUE_REGISTRY };
