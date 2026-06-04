import { cosmicTriviaRuntime } from "./cosmic-trivia.js";

const gameRuntimes = {
  "cosmic-trivia": cosmicTriviaRuntime
};

export function runtimeFor(gameId) {
  return gameRuntimes[gameId] || gameRuntimes["cosmic-trivia"];
}
