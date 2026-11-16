import type { Bar, Timeframe } from "@/lib/types";

const TF_MS: Record<Timeframe, number> = {
  M1: 60_000,
  M5: 5 * 60_000,
  M15: 15 * 60_000,
  H1: 60 * 60_000,
  H4: 4 * 60 * 60_000,
  D1: 24 * 60 * 60_000,
};

const INSTRUMENT_PROFILES: Record<
  string,
  { start: number; vol: number; drift: number; sessionAmp: number }
> = {
  XAUUSD: { start: 1850, vol: 0.0045, drift: 0.00002, sessionAmp: 0.35 },
  USDJPY: { start: 145, vol: 0.0028, drift: 0.00001, sessionAmp: 0.4 },
  EURUSD: { start: 1.08, vol: 0.0022, drift: 0, sessionAmp: 0.45 },
  GBPUSD: { start: 1.26, vol: 0.0026, drift: 0, sessionAmp: 0.42 },
  USATECHIDXUSD: { start: 18000, vol: 0.0055, drift: 0.00003, sessionAmp: 0.55 },
  DEUIDXEUR: { start: 16000, vol: 0.0048, drift: 0.000015, sessionAmp: 0.5 },
  USA500IDXUSD: { start: 4800, vol: 0.0042, drift: 0.000025, sessionAmp: 0.5 },
  AUDUSD: { start: 0.66, vol: 0.0029, drift: 0, sessionAmp: 0.38 },
  USDCAD: { start: 1.36, vol: 0.0024, drift: 0, sessionAmp: 0.36 },
  NZDUSD: { start: 0.61, vol: 0.0031, drift: 0, sessionAmp: 0.4 },
  BTCUSD: { start: 42000, vol: 0.012, drift: 0.00004, sessionAmp: 0.2 },
  NAS100: { start: 18000, vol: 0.0055, drift: 0.00003, sessionAmp: 0.55 },
};

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG — deterministic per instrument/timeframe/years. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function profileFor(instrument: string) {
  return (
    INSTRUMENT_PROFILES[instrument] ?? {
      start: 100,
      vol: 0.003,
      drift: 0,
      sessionAmp: 0.3,
    }
  );
}

/**
 * Generate deterministic synthetic OHLC covering ~`years` of history.
 * Enough for demo backtests with real costs; not a substitute for tick data.
 */
export function generateOhlc(
  instrument: string,
  timeframe: Timeframe,
  years = 5,
): Bar[] {
  const profile = profileFor(instrument);
  const step = TF_MS[timeframe];
  // Cap bars so demos stay interactive (still years of H1/H4; months+ of M5).
  const MAX_BARS = 12_000;
  const barsNeeded = Math.min(
    MAX_BARS,
    Math.max(500, Math.floor((years * 365.25 * 24 * 60 * 60 * 1000) / step)),
  );
  const rand = mulberry32(hashSeed(`${instrument}|${timeframe}|${years}`));
  const end = Date.UTC(2026, 10, 16, 12, 0, 0);
  const start = end - barsNeeded * step;

  const bars: Bar[] = [];
  let price = profile.start;

  for (let i = 0; i < barsNeeded; i++) {
    const time = start + i * step;
    const dt = new Date(time);
    const hour = dt.getUTCHours();
    const day = dt.getUTCDay();
    // London/NY overlap bump; Asian quieter for FX-like instruments.
    const session =
      1 +
      profile.sessionAmp *
        (hour >= 7 && hour <= 16 ? 0.55 : hour >= 0 && hour < 7 ? -0.25 : 0.15);
    // Mild structured edges so rule templates can show a non-empty demo portfolio.
    // Not a claim about live markets — demo figures only.
    let structure = 0;
    if (day === 1 && hour >= 7 && hour <= 10) structure += profile.vol * 0.08; // Monday impulse
    if (day === 2 && hour >= 7 && hour <= 12) structure += profile.vol * 0.06; // Turnaround Tuesday drift
    if (hour >= 7 && hour <= 9) structure += profile.vol * 0.04; // London open drift
    if (day === 5 && hour >= 15) structure -= profile.vol * 0.05; // Friday fade
    // Occasional range expansion bursts
    if (rand() < 0.015) structure += (rand() - 0.35) * profile.vol * 2.2;

    const shock =
      (rand() - 0.5) * 2 * profile.vol * session +
      (rand() - 0.5) * profile.vol * 0.3 +
      structure;
    const open = price;
    const close = Math.max(0.0001, open * (1 + profile.drift + shock));
    const wick = profile.vol * session * (0.2 + rand() * 0.8);
    const high = Math.max(open, close) * (1 + wick * rand());
    const low = Math.min(open, close) * (1 - wick * rand());
    const volume = 80 + rand() * 220 * session;
    bars.push({ time, open, high, low, close, volume });
    price = close;
  }

  return bars;
}

export function barsPerDay(timeframe: Timeframe): number {
  return (24 * 60 * 60 * 1000) / TF_MS[timeframe];
}
