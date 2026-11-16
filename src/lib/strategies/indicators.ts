import type { Bar } from "@/lib/types";

export function sma(closes: number[], period: number, i: number): number | null {
  if (i + 1 < period) return null;
  let sum = 0;
  for (let j = i - period + 1; j <= i; j++) sum += closes[j];
  return sum / period;
}

export function ema(closes: number[], period: number, i: number): number | null {
  if (i + 1 < period) return null;
  const k = 2 / (period + 1);
  let value = closes[i - period + 1];
  for (let j = i - period + 2; j <= i; j++) {
    value = closes[j] * k + value * (1 - k);
  }
  return value;
}

export function trueRange(bars: Bar[], j: number): number {
  const prevClose = bars[j - 1]?.close ?? bars[j].open;
  return Math.max(
    bars[j].high - bars[j].low,
    Math.abs(bars[j].high - prevClose),
    Math.abs(bars[j].low - prevClose),
  );
}

export function atr(bars: Bar[], period: number, i: number): number | null {
  if (i < period) return null;
  let sum = 0;
  for (let j = i - period + 1; j <= i; j++) sum += trueRange(bars, j);
  return sum / period;
}

/** Mean of ATR over [i - smaPeriod + 1, i] without allocating a series. */
export function atrSma(
  bars: Bar[],
  atrPeriod: number,
  smaPeriod: number,
  i: number,
): number | null {
  if (i < atrPeriod + smaPeriod - 1) return null;
  let sum = 0;
  for (let j = i - smaPeriod + 1; j <= i; j++) {
    const a = atr(bars, atrPeriod, j);
    if (a == null) return null;
    sum += a;
  }
  return sum / smaPeriod;
}

/** True if ATR(i) is the minimum ATR in the last `lookback` bars. */
export function atrIsCompressing(
  bars: Bar[],
  atrPeriod: number,
  lookback: number,
  i: number,
): boolean {
  const a = atr(bars, atrPeriod, i);
  if (a == null || i + 1 < lookback) return false;
  for (let j = i - lookback + 1; j < i; j++) {
    const aj = atr(bars, atrPeriod, j);
    if (aj != null && aj < a * 0.999) return false;
  }
  return true;
}

export function rsi(closes: number[], period: number, i: number): number | null {
  if (i < period) return null;
  let gains = 0;
  let losses = 0;
  for (let j = i - period + 1; j <= i; j++) {
    const d = closes[j] - closes[j - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

export function highest(values: number[], period: number, i: number): number | null {
  if (i + 1 < period) return null;
  let m = -Infinity;
  for (let j = i - period + 1; j <= i; j++) m = Math.max(m, values[j]);
  return m;
}

export function lowest(values: number[], period: number, i: number): number | null {
  if (i + 1 < period) return null;
  let m = Infinity;
  for (let j = i - period + 1; j <= i; j++) m = Math.min(m, values[j]);
  return m;
}

export function utcHour(time: number): number {
  return new Date(time).getUTCHours();
}

export function utcDay(time: number): number {
  return new Date(time).getUTCDay();
}
