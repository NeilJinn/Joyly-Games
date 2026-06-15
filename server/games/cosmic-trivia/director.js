import { createDirectorFlow } from "../../../public/shared/director/flow.js";
import {
  COSMIC_TRIVIA_PHASES,
  COSMIC_TRIVIA_AUDIO_ADVANCE_FALLBACK_MS
} from "../../../public/shared/director/cosmic-trivia-phases.js";

const cosmicTriviaDirectorSchema = createDirectorFlow({ phases: COSMIC_TRIVIA_PHASES });

export const getDirectorStep = cosmicTriviaDirectorSchema.getDirectorStep;
export const getDirectorMessage = cosmicTriviaDirectorSchema.getDirectorMessage;
export const getDirectorTimerMs = cosmicTriviaDirectorSchema.getDirectorTimerMs;
export const getDirectorMode = cosmicTriviaDirectorSchema.getDirectorMode;
export const shouldAdvanceOnAudioEnd = cosmicTriviaDirectorSchema.shouldAdvanceOnAudioEnd;

export { COSMIC_TRIVIA_AUDIO_ADVANCE_FALLBACK_MS as AUDIO_ADVANCE_FALLBACK_MS };
export default cosmicTriviaDirectorSchema;
