/**
 * Game feature flags driven by env config (see `.env`).
 *
 * - VITE_DENOMINATION_GAMES: games that expose the Denomination input.
 * - VITE_JACKPOT_GAMES: game ids treated as jackpots (`[1,2]` or `1,2`).
 *
 * Jackpot-only inputs are fixed to this list and only shown when the selected
 * game matches a configured id in VITE_JACKPOT_GAMES.
 */

import { parseIdList } from "@/lib/env-list";
import { pickEnvPairRaw } from "@/lib/env";

const env = import.meta.env as Record<string, string | undefined>;
const denominationEnv = pickEnvPairRaw("VITE_DENOMINATION_GAMES") ?? env.VITE_DENOMINATION_GAMES;
const jackpotEnv = pickEnvPairRaw("VITE_JACKPOT_GAMES") ?? env.VITE_JACKPOT_GAMES;

export const DENOMINATION_GAMES = parseIdList(denominationEnv);
export const JACKPOT_GAMES = parseIdList(jackpotEnv);
export const JACKPOT_FIELDS = ["stake", "total_games", "minimum_win", "maximum_win"];

/** Identity of the game currently selected in a form / row. */
export type GameIdentity = { id?: string | null; name?: string | null };

/** Matching is by game id only — the env lists contain ids, not names. */
function matches(list: string[], game: GameIdentity): boolean {
  const id = game.id !== undefined && game.id !== null ? String(game.id).trim() : "";
  if (!id) return false;
  return list.some((entry) => entry === id);
}

export function isDenominationGame(game: GameIdentity): boolean {
  return matches(DENOMINATION_GAMES, game);
}

export function isJackpotGame(game: GameIdentity): boolean {
  return matches(JACKPOT_GAMES, game);
}
