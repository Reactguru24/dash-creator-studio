/**
 * Game feature flags driven by env config (see `.env`).
 *
 * - VITE_DENOMINATION_GAMES: games that expose the Denomination input.
 * - VITE_JACKPOT_GAMES: games treated as jackpots.
 * - VITE_JACKPOT_FIELDS: the only fields shown for jackpot games.
 */

function parseList(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

const env = import.meta.env as Record<string, string | undefined>;

export const DENOMINATION_GAMES = parseList(env.VITE_DENOMINATION_GAMES);
export const JACKPOT_GAMES = parseList(env.VITE_JACKPOT_GAMES);
const jackpotFields = parseList(env.VITE_JACKPOT_FIELDS);
/** Defaults to `total_games` when the env var is not configured. */
export const JACKPOT_FIELDS = jackpotFields.length ? jackpotFields : ["total_games"];

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
