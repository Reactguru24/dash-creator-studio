/**
 * Hard-coded demo datasets.
 *
 * The staging backoffice API does not expose telemetry (latency, CCU/DAU/MAU,
 * client-side error stream, session durations, bet-size distribution). Those
 * panels render from the fixtures below so the product surface is complete;
 * every panel using them is badged "Demo data" in the UI.
 */

export type MarginTier = "Crash games" | "Traditional Slots" | "Virtuals";

export type GamePerformanceRow = {
  game: string;
  studio: string;
  client: string;
  vertical: MarginTier;
  total_bets: number;
  total_wins: number;
  bonuses: number;
  tax: number;
  platform_fees: number;
};

export const GAME_PERFORMANCE: GamePerformanceRow[] = [
  {
    game: "Aviator",
    studio: "Spribe",
    client: "BetLion",
    vertical: "Crash games",
    total_bets: 1842000,
    total_wins: 1701300,
    bonuses: 24100,
    tax: 18900,
    platform_fees: 12600,
  },
  {
    game: "JetX",
    studio: "SmartSoft",
    client: "BetLion",
    vertical: "Crash games",
    total_bets: 963400,
    total_wins: 882100,
    bonuses: 11200,
    tax: 9800,
    platform_fees: 7100,
  },
  {
    game: "Euro League",
    studio: "EuroVirtuals",
    client: "PariPesa",
    vertical: "Virtuals",
    total_bets: 754200,
    total_wins: 655800,
    bonuses: 8400,
    tax: 7300,
    platform_fees: 6050,
  },
  {
    game: "Rocket Queen",
    studio: "Gamzix",
    client: "PariPesa",
    vertical: "Crash games",
    total_bets: 421800,
    total_wins: 392400,
    bonuses: 5100,
    tax: 4200,
    platform_fees: 3300,
  },
  {
    game: "Book of Kraft",
    studio: "Kraft Studio",
    client: "MegaBet",
    vertical: "Traditional Slots",
    total_bets: 688900,
    total_wins: 592200,
    bonuses: 13400,
    tax: 8100,
    platform_fees: 5400,
  },
  {
    game: "Sweet Reels",
    studio: "Kraft Studio",
    client: "MegaBet",
    vertical: "Traditional Slots",
    total_bets: 512300,
    total_wins: 451900,
    bonuses: 9600,
    tax: 6200,
    platform_fees: 4100,
  },
  {
    game: "Virtual Dogs",
    studio: "EuroVirtuals",
    client: "SafariBet",
    vertical: "Virtuals",
    total_bets: 318700,
    total_wins: 271500,
    bonuses: 4300,
    tax: 3600,
    platform_fees: 2500,
  },
  {
    game: "Penalty Shootout",
    studio: "EuroVirtuals",
    client: "SafariBet",
    vertical: "Virtuals",
    total_bets: 264100,
    total_wins: 228300,
    bonuses: 3100,
    tax: 2900,
    platform_fees: 2100,
  },
];

export function ggrOf(row: GamePerformanceRow) {
  return row.total_bets - row.total_wins;
}

export function ngrOf(row: GamePerformanceRow) {
  return ggrOf(row) - (row.bonuses + row.tax + row.platform_fees);
}

export function marginOf(row: GamePerformanceRow) {
  return row.total_bets === 0 ? 0 : (ngrOf(row) / row.total_bets) * 100;
}

/** Latency matrix: response times (ms) per client per endpoint. */
export const LATENCY_ENDPOINTS = ["/auth", "/balance", "/bet", "/win", "/rollback"] as const;

export const LATENCY_MATRIX: { client: string; values: number[] }[] = [
  { client: "BetLion", values: [118, 96, 142, 151, 187] },
  { client: "PariPesa", values: [201, 178, 312, 341, 402] },
  { client: "MegaBet", values: [88, 74, 121, 133, 165] },
  { client: "SafariBet", values: [264, 231, 289, 355, 512] },
  { client: "KwikBet", values: [141, 122, 199, 210, 246] },
];

export const LATENCY_BOUNDARY_MS = 300;
export const LATENCY_WARN_MS = 220;

export type ErrorEvent = {
  id: string;
  at: string;
  kind: "Wallet handshake" | "Crash loop interrupted" | "Script load" | "Iframe init";
  message: string;
  clientId: string;
  sessionToken: string;
  device: string;
  stack: string;
};

export const ERROR_STREAM: ErrorEvent[] = [
  {
    id: "e-9412",
    at: "08:41:02",
    kind: "Wallet handshake",
    message: "POST /callback/bet timed out after 5000ms",
    clientId: "cl_4471 · PariPesa",
    sessionToken: "sess_9f3a…c21",
    device: "Chrome 141 / Android 14",
    stack: "at WalletClient.bet (wallet.ts:184)\nat GameLoop.placeBet (loop.ts:96)",
  },
  {
    id: "e-9411",
    at: "08:39:47",
    kind: "Crash loop interrupted",
    message: "WebSocket closed unexpectedly (code 1006) mid-round",
    clientId: "cl_2210 · SafariBet",
    sessionToken: "sess_11b7…88e",
    device: "Safari 19 / iOS 26",
    stack: "at Socket.onclose (rt.ts:212)\nat CrashRound.tick (crash.ts:57)",
  },
  {
    id: "e-9409",
    at: "08:36:15",
    kind: "Script load",
    message: "Failed to fetch sdk.bundle.js — 502 from edge",
    clientId: "cl_1180 · MegaBet",
    sessionToken: "sess_44de…0a3",
    device: "Chrome 140 / Windows 11",
    stack: "at loadScript (bootstrap.ts:41)",
  },
  {
    id: "e-9404",
    at: "08:31:58",
    kind: "Iframe init",
    message: "Launch token rejected: player_token expired",
    clientId: "cl_4471 · PariPesa",
    sessionToken: "sess_7c02…9fd",
    device: "Chrome 141 / Android 13",
    stack: "at verifyToken (launch.ts:73)",
  },
];

/** Concurrent users sampled every 5 minutes for the last hour. */
export const CCU_SERIES = [
  { t: "07:45", ccu: 8120 },
  { t: "07:50", ccu: 8460 },
  { t: "07:55", ccu: 8890 },
  { t: "08:00", ccu: 9310 },
  { t: "08:05", ccu: 9024 },
  { t: "08:10", ccu: 9702 },
  { t: "08:15", ccu: 10188 },
  { t: "08:20", ccu: 10460 },
  { t: "08:25", ccu: 10120 },
  { t: "08:30", ccu: 10744 },
  { t: "08:35", ccu: 11002 },
  { t: "08:40", ccu: 11316 },
];

export const CCU_NOW = 11316;
export const ACTIVE_SOCKETS = 11840;

export const DAU_MAU_SERIES = Array.from({ length: 30 }).map((_, index) => {
  const day = new Date(Date.UTC(2026, 5, 30 + index));
  const dau = 41000 + Math.round(Math.sin(index / 3.1) * 5200 + index * 190);
  return {
    day: day.toISOString().slice(5, 10),
    dau,
    mau: 480000 + index * 1450,
  };
});

export const SESSION_STATS = {
  avgSessionMinutes: 18.4,
  avgRoundsPerSession: 42,
  medianSessionMinutes: 12.1,
};

export const BET_SIZE_DISTRIBUTION = [
  { tier: "Min bet", range: "0.10 – 0.50", wagers: 184200 },
  { tier: "Standard", range: "0.51 – 5.00", wagers: 421800 },
  { tier: "Mid-tier", range: "5.01 – 25.00", wagers: 168400 },
  { tier: "High", range: "25.01 – 100.00", wagers: 54300 },
  { tier: "MAX stake", range: "100.01+", wagers: 12900 },
];

export const CLIENT_CONCENTRATION = [
  { client: "BetLion", ggr: 2804000 },
  { client: "PariPesa", ggr: 1176000 },
  { client: "MegaBet", ggr: 963000 },
  { client: "SafariBet", ggr: 512000 },
  { client: "KwikBet", ggr: 288000 },
];

export const PROMO_CONVERSION = [
  { campaign: "Welcome 100 FR", awarded: 42000, deposited: 12800 },
  { campaign: "Aviator Weekend", awarded: 31500, deposited: 11960 },
  { campaign: "Slots Cashback", awarded: 18200, deposited: 4900 },
  { campaign: "Euro League Boost", awarded: 12400, deposited: 5100 },
];

export type OpsAlert = {
  id: string;
  severity: "critical" | "warning";
  title: string;
  detail: string;
};

export const OPS_ALERTS: OpsAlert[] = [
  {
    id: "a1",
    severity: "critical",
    title: "SafariBet DAU down 24% week-over-week",
    detail: "Rolling 7-day active players fell from 9,140 to 6,946. Threshold is 20%.",
  },
  {
    id: "a2",
    severity: "critical",
    title: "BetLion exposure at 39% of platform GGR",
    detail: "Single-client concentration exceeds the 35% risk ceiling.",
  },
  {
    id: "a3",
    severity: "warning",
    title: "PariPesa /bet latency above 300ms",
    detail: "5-minute rolling average is 312ms across 4,120 callbacks.",
  },
  {
    id: "a4",
    severity: "warning",
    title: "Transaction failure rate 1.8% on Rocket Queen",
    detail: "Above the 1.5% spike threshold in the last minute.",
  },
];

/** Trend fixture for the interactive analytics chart, keyed by interval. */
export type TrendInterval = "hour" | "day" | "week" | "month";

const SERIES_KEYS = ["BetLion", "PariPesa", "MegaBet", "SafariBet"] as const;
export type SeriesKey = (typeof SERIES_KEYS)[number];
export const TREND_SERIES = SERIES_KEYS;

function seeded(index: number, offset: number) {
  return Math.abs(Math.sin((index + 1) * (offset + 1.7)));
}

export function trendData(interval: TrendInterval, axis: "ggr" | "volume" | "players") {
  const buckets: Record<TrendInterval, string[]> = {
    hour: Array.from({ length: 24 }).map((_, i) => `${String(i).padStart(2, "0")}:00`),
    day: Array.from({ length: 30 }).map((_, i) => `D${i + 1}`),
    week: Array.from({ length: 12 }).map((_, i) => `W${i + 1}`),
    month: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  };
  const scale = axis === "ggr" ? 42000 : axis === "volume" ? 180000 : 5200;
  return buckets[interval].map((label, index) => {
    const point: Record<string, string | number> = { label };
    SERIES_KEYS.forEach((key, s) => {
      point[key] = Math.round(scale * (0.45 + seeded(index, s) * 0.75) * (1 - s * 0.16));
    });
    return point;
  });
}
