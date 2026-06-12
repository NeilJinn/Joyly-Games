import { cosmicTriviaRuntime } from "./cosmic-trivia.js";
import { fateWerewolfRuntime } from "./fate-werewolf.js";

const gameRuntimes = {
  "cosmic-trivia": cosmicTriviaRuntime,
  "fate-werewolf": fateWerewolfRuntime
};

export function runtimeFor(gameId) {
  return gameRuntimes[gameId] || gameRuntimes["cosmic-trivia"];
}
