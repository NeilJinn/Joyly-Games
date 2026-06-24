import { cosmicTriviaRuntime } from "./cosmic-trivia.js";
import { werewolfRuntime } from "../../games/werewolf/server/game.js";

const gameRuntimes = {
  "cosmic-trivia": cosmicTriviaRuntime,
  "fate-werewolf": werewolfRuntime
};

export function runtimeFor(gameId) {
  return gameRuntimes[gameId] || gameRuntimes["cosmic-trivia"];
}
