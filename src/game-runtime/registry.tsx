import type { GamePackage } from "./types";
import { cosmicTriviaPackage } from "../../games/cosmic-trivia/client/package";
import { fateWerewolfPackage } from "../../games/werewolf/client/package";

const packages: readonly GamePackage[] = [cosmicTriviaPackage, fateWerewolfPackage];

export function listGamePackages(): readonly GamePackage[] {
  return packages;
}

export function getGamePackage(gameId: string | null | undefined): GamePackage | undefined {
  if (!gameId) return undefined;
  return packages.find((game) => game.id === gameId);
}
