import type { StrategyFn, StrategyTemplate } from "@/lib/types";
import {
  atr,
  atrIsCompressing,
  atrSma,
  ema,
  highest,
  lowest,
  rsi,
  sma,
  utcDay,
  utcHour,
} from "@/lib/strategies/indicators";

function n(params: Record<string, number | string | boolean>, key: string, fallback: number): number {
  const v = params[key];
  return typeof v === "number" ? v : fallback;
}

/** 19 ready-to-read strategy templates. Rules are open and editable. */
export const STRATEGY_TEMPLATES: StrategyTemplate[] = [
  {
    id: "atr-expansion-xau",
    name: "ATR Expansion Gold",
    instrument: "XAUUSD",
    timeframe: "H1",
    category: "Momentum",
    description: "Enter when ATR expands above its average and price breaks the recent range.",
    rules: [
      "ATR(14) > SMA(ATR, 20) * expansion",
      "Close breaks highest/lowest of lookback",
      "Stop = ATR * stopMult; TP = stop * takeProfitR",
    ],
    params: { atrPeriod: 14, atrSma: 20, expansion: 1.15, lookback: 12, stopMult: 1.2, takeProfitR: 1.8 },
    warmup: 40,
  },
  {
    id: "daily-range-breakout-usdjpy",
    name: "Daily Range Breakout",
    instrument: "USDJPY",
    timeframe: "H1",
    category: "Breakout",
    description: "6-bar range bracket breakout with session filter.",
    rules: [
      "Build high/low of prior N bars",
      "Enter on close beyond bracket",
      "Only trade London hours (07–16 UTC)",
    ],
    params: { lookback: 6, stopMult: 1.0, takeProfitR: 2.0 },
    warmup: 20,
  },
  {
    id: "asian-session-sweep-usatech",
    name: "Asian Session Sweep",
    instrument: "USATECHIDXUSD",
    timeframe: "M5",
    category: "Reversal",
    description: "Sweep Asian range extremes, then reclaim — fade the sweep.",
    rules: [
      "Mark Asian range 00:00–06:59 UTC",
      "Wait for pierce beyond range then close back inside",
      "Fade toward mid-range",
    ],
    params: { stopMult: 0.9, takeProfitR: 1.6 },
    warmup: 120,
  },
  {
    id: "turnaround-tuesday-de40",
    name: "Turnaround Tuesday",
    instrument: "DEUIDXEUR",
    timeframe: "M15",
    category: "Mean reversion",
    description: "Buy Monday weakness into Tuesday mean reversion.",
    rules: [
      "Monday close below Friday SMA(20) → bias long",
      "Enter Tuesday first London hour",
      "Exit same day or at TP",
    ],
    params: { smaPeriod: 20, stopMult: 1.1, takeProfitR: 1.5 },
    warmup: 30,
  },
  {
    id: "fu-retest-us500",
    name: "4H FU Retest",
    instrument: "USA500IDXUSD",
    timeframe: "M15",
    category: "Reversal",
    description: "4-hour window sweep and reclaim of prior swing.",
    rules: [
      "Identify prior 16-bar swing high/low",
      "Sweep then reclaim within 4 hours",
      "Enter reclaim close",
    ],
    params: { swing: 16, stopMult: 1.0, takeProfitR: 2.2 },
    warmup: 40,
  },
  {
    id: "london-breakout-eurusd",
    name: "London Breakout",
    instrument: "EURUSD",
    timeframe: "M15",
    category: "Breakout",
    description: "Break of Asian range at London open.",
    rules: [
      "Asian high/low 00–07 UTC",
      "Enter first break after 07:00",
      "One trade per day",
    ],
    params: { stopMult: 0.85, takeProfitR: 1.7 },
    warmup: 80,
  },
  {
    id: "ema-pullback-gbpusd",
    name: "EMA Pullback Trend",
    instrument: "GBPUSD",
    timeframe: "H1",
    category: "Trend",
    description: "Trade pullbacks to EMA in the direction of the higher EMA.",
    rules: [
      "Trend = EMA(50) vs EMA(200)",
      "Enter when price tags EMA(21) and closes back with trend",
    ],
    params: { fast: 21, mid: 50, slow: 200, stopMult: 1.3, takeProfitR: 2.5 },
    warmup: 210,
  },
  {
    id: "rsi-mean-revert-audusd",
    name: "RSI Mean Reversion",
    instrument: "AUDUSD",
    timeframe: "H1",
    category: "Mean reversion",
    description: "Fade RSI extremes when price is stretched from SMA.",
    rules: [
      "RSI(14) < 28 → long; > 72 → short",
      "Price > 1 ATR from SMA(50)",
    ],
    params: { rsiPeriod: 14, low: 28, high: 72, smaPeriod: 50, stopMult: 1.0, takeProfitR: 1.4 },
    warmup: 60,
  },
  {
    id: "ny-open-drive-nas100",
    name: "NY Open Drive",
    instrument: "NAS100",
    timeframe: "M5",
    category: "Momentum",
    description: "Momentum continuation in the first hour after NY cash open.",
    rules: [
      "Window 13:30–14:30 UTC",
      "Enter if 3 consecutive closes in one direction after open",
    ],
    params: { stopMult: 1.1, takeProfitR: 1.8 },
    warmup: 40,
  },
  {
    id: "bollinger-squeeze-usdcad",
    name: "Volatility Squeeze Break",
    instrument: "USDCAD",
    timeframe: "H1",
    category: "Breakout",
    description: "Break from a compressed ATR regime.",
    rules: [
      "ATR(14) at 20-bar low",
      "Break highest/lowest of 10 bars",
    ],
    params: { atrPeriod: 14, compressLookback: 20, breakLookback: 10, stopMult: 1.2, takeProfitR: 2.0 },
    warmup: 40,
  },
  {
    id: "friday-fade-eurusd",
    name: "Friday Afternoon Fade",
    instrument: "EURUSD",
    timeframe: "M15",
    category: "Mean reversion",
    description: "Fade late-week extension into Friday close.",
    rules: [
      "Friday after 15:00 UTC",
      "Price > 1.5 ATR from daily-ish SMA → fade",
    ],
    params: { smaPeriod: 64, atrMult: 1.5, stopMult: 0.9, takeProfitR: 1.2 },
    warmup: 80,
  },
  {
    id: "overnight-gap-fill-us500",
    name: "Overnight Gap Fill",
    instrument: "USA500IDXUSD",
    timeframe: "M15",
    category: "Mean reversion",
    description: "Fade gaps larger than ATR at the cash open.",
    rules: [
      "At 13:30–14:00 UTC compare open vs prior close",
      "Gap > 0.4 ATR → fade toward prior close",
    ],
    params: { gapAtr: 0.4, stopMult: 1.0, takeProfitR: 1.3 },
    warmup: 40,
  },
  {
    id: "donchian-trend-xau",
    name: "Donchian Trend Follow",
    instrument: "XAUUSD",
    timeframe: "H4",
    category: "Trend",
    description: "Classic channel breakout with trailing structure.",
    rules: [
      "Long on close above 20-bar high",
      "Short on close below 20-bar low",
    ],
    params: { channel: 20, stopMult: 1.5, takeProfitR: 3.0 },
    warmup: 30,
  },
  {
    id: "session-vwap-reversion-gbpusd",
    name: "Session Mid Reversion",
    instrument: "GBPUSD",
    timeframe: "M15",
    category: "Mean reversion",
    description: "Revert to session VWAP proxy (typical price SMA).",
    rules: [
      "Use SMA(typical, 20) as session mid",
      "Enter when close is 1.2 ATR away and RSI confirms",
    ],
    params: { midPeriod: 20, atrMult: 1.2, stopMult: 1.0, takeProfitR: 1.5 },
    warmup: 40,
  },
  {
    id: "macd-cross-nzdusd",
    name: "MACD Momentum Cross",
    instrument: "NZDUSD",
    timeframe: "H1",
    category: "Momentum",
    description: "EMA differential cross filtered by slow trend.",
    rules: [
      "Fast EMA(12) cross slow EMA(26)",
      "Trade with EMA(100) slope",
    ],
    params: { fast: 12, slow: 26, trend: 100, stopMult: 1.2, takeProfitR: 2.0 },
    warmup: 120,
  },
  {
    id: "range-fade-usdjpy",
    name: "Quiet Range Fade",
    instrument: "USDJPY",
    timeframe: "M15",
    category: "Mean reversion",
    description: "Fade edges of a low-ATR Asian/London morning range.",
    rules: [
      "ATR below its SMA",
      "Touch of 20-bar high/low → fade to mid",
    ],
    params: { lookback: 20, stopMult: 0.8, takeProfitR: 1.2 },
    warmup: 40,
  },
  {
    id: "breakout-retest-audusd",
    name: "Breakout Retest",
    instrument: "AUDUSD",
    timeframe: "H1",
    category: "Breakout",
    description: "Break a level, wait for retest, continue.",
    rules: [
      "Break 24-bar high/low",
      "Retest within 8 bars then continue",
    ],
    params: { level: 24, retestBars: 8, stopMult: 1.0, takeProfitR: 2.0 },
    warmup: 40,
  },
  {
    id: "crypto-vol-trend-btc",
    name: "BTC Vol Expansion Trend",
    instrument: "BTCUSD",
    timeframe: "H1",
    category: "Momentum",
    description: "Ride BTC when hourly ATR expands with EMA alignment.",
    rules: [
      "EMA(20) > EMA(50) for longs (inverse shorts)",
      "ATR expanding vs prior 10 bars",
    ],
    params: { fast: 20, slow: 50, stopMult: 1.8, takeProfitR: 2.8 },
    warmup: 60,
  },
  {
    id: "monday-gap-continuation-de40",
    name: "Monday Gap Continuation",
    instrument: "DEUIDXEUR",
    timeframe: "M15",
    category: "Momentum",
    description: "Continue Monday opening impulse if first hour holds.",
    rules: [
      "Monday 07–08 UTC impulse direction",
      "Enter continuation if first pullback holds VWAP proxy",
    ],
    params: { stopMult: 1.1, takeProfitR: 1.9 },
    warmup: 40,
  },
];

function closesOf(bars: { close: number }[]): number[] {
  return bars.map((b) => b.close);
}

export const STRATEGY_LOGIC: Record<string, StrategyFn> = {
  "atr-expansion-xau": ({ bars, i, params }) => {
    const atrPeriod = n(params, "atrPeriod", 14);
    const a = atr(bars, atrPeriod, i);
    const aSma = atrSma(bars, atrPeriod, n(params, "atrSma", 20), i);
    if (a == null || aSma == null || a <= aSma * n(params, "expansion", 1.15)) return null;
    const lookback = n(params, "lookback", 12);
    const highs = bars.map((b) => b.high);
    const lows = bars.map((b) => b.low);
    const hh = highest(highs, lookback, i - 1);
    const ll = lowest(lows, lookback, i - 1);
    if (hh == null || ll == null) return null;
    const stop = (a / bars[i].close) * n(params, "stopMult", 1.2);
    const tp = n(params, "takeProfitR", 1.8);
    if (bars[i].close > hh) return { side: "long", stopDistancePct: stop, takeProfitR: tp };
    if (bars[i].close < ll) return { side: "short", stopDistancePct: stop, takeProfitR: tp };
    return null;
  },

  "daily-range-breakout-usdjpy": ({ bars, i, params }) => {
    const hour = utcHour(bars[i].time);
    if (hour < 7 || hour > 16) return null;
    const lookback = n(params, "lookback", 6);
    const hh = highest(bars.map((b) => b.high), lookback, i - 1);
    const ll = lowest(bars.map((b) => b.low), lookback, i - 1);
    const a = atr(bars, 14, i);
    if (hh == null || ll == null || a == null) return null;
    const stop = (a / bars[i].close) * n(params, "stopMult", 1.0);
    const tp = n(params, "takeProfitR", 2.0);
    if (bars[i].close > hh) return { side: "long", stopDistancePct: stop, takeProfitR: tp };
    if (bars[i].close < ll) return { side: "short", stopDistancePct: stop, takeProfitR: tp };
    return null;
  },

  "asian-session-sweep-usatech": ({ bars, i, params }) => {
    const hour = utcHour(bars[i].time);
    if (hour < 7 || hour > 12) return null;
    // Approximate Asian range from prior bars between 0–7 on same day cluster.
    let hi = -Infinity;
    let lo = Infinity;
    let found = 0;
    for (let j = i - 1; j >= Math.max(0, i - 120); j--) {
      const h = utcHour(bars[j].time);
      if (h >= 0 && h < 7) {
        hi = Math.max(hi, bars[j].high);
        lo = Math.min(lo, bars[j].low);
        found++;
      }
      if (found > 60) break;
    }
    if (found < 10) return null;
    const a = atr(bars, 14, i);
    if (a == null) return null;
    const stop = (a / bars[i].close) * n(params, "stopMult", 0.9);
    const tp = n(params, "takeProfitR", 1.6);
    const piercedHigh = bars[i - 1].high > hi && bars[i].close < hi;
    const piercedLow = bars[i - 1].low < lo && bars[i].close > lo;
    if (piercedHigh) return { side: "short", stopDistancePct: stop, takeProfitR: tp };
    if (piercedLow) return { side: "long", stopDistancePct: stop, takeProfitR: tp };
    return null;
  },

  "turnaround-tuesday-de40": ({ bars, i, params }) => {
    if (utcDay(bars[i].time) !== 2) return null;
    if (utcHour(bars[i].time) !== 7) return null;
    const closes = closesOf(bars);
    const s = sma(closes, n(params, "smaPeriod", 20), i);
    const a = atr(bars, 14, i);
    if (s == null || a == null) return null;
    // Monday weakness proxy: prior day-ish close below SMA.
    if (closes[i - 1] >= s) return null;
    const stop = (a / bars[i].close) * n(params, "stopMult", 1.1);
    return { side: "long", stopDistancePct: stop, takeProfitR: n(params, "takeProfitR", 1.5) };
  },

  "fu-retest-us500": ({ bars, i, params }) => {
    const swing = n(params, "swing", 16);
    const hh = highest(bars.map((b) => b.high), swing, i - 1);
    const ll = lowest(bars.map((b) => b.low), swing, i - 1);
    const a = atr(bars, 14, i);
    if (hh == null || ll == null || a == null) return null;
    const stop = (a / bars[i].close) * n(params, "stopMult", 1.0);
    const tp = n(params, "takeProfitR", 2.2);
    if (bars[i - 1].high > hh && bars[i].close < hh && bars[i].close > (hh + ll) / 2) {
      return { side: "short", stopDistancePct: stop, takeProfitR: tp };
    }
    if (bars[i - 1].low < ll && bars[i].close > ll && bars[i].close < (hh + ll) / 2) {
      return { side: "long", stopDistancePct: stop, takeProfitR: tp };
    }
    return null;
  },

  "london-breakout-eurusd": ({ bars, i, params }) => {
    const hour = utcHour(bars[i].time);
    if (hour < 7 || hour > 10) return null;
    let hi = -Infinity;
    let lo = Infinity;
    let found = 0;
    for (let j = i - 1; j >= Math.max(0, i - 80); j--) {
      const h = utcHour(bars[j].time);
      if (h >= 0 && h < 7) {
        hi = Math.max(hi, bars[j].high);
        lo = Math.min(lo, bars[j].low);
        found++;
      }
      if (found > 40) break;
    }
    if (found < 8) return null;
    const a = atr(bars, 14, i);
    if (a == null) return null;
    const stop = (a / bars[i].close) * n(params, "stopMult", 0.85);
    const tp = n(params, "takeProfitR", 1.7);
    if (bars[i].close > hi) return { side: "long", stopDistancePct: stop, takeProfitR: tp };
    if (bars[i].close < lo) return { side: "short", stopDistancePct: stop, takeProfitR: tp };
    return null;
  },

  "ema-pullback-gbpusd": ({ bars, i, params }) => {
    const closes = closesOf(bars);
    const eFast = ema(closes, n(params, "fast", 21), i);
    const eMid = ema(closes, n(params, "mid", 50), i);
    const eSlow = ema(closes, n(params, "slow", 200), i);
    const a = atr(bars, 14, i);
    if (eFast == null || eMid == null || eSlow == null || a == null) return null;
    const stop = (a / bars[i].close) * n(params, "stopMult", 1.3);
    const tp = n(params, "takeProfitR", 2.5);
    const touched = bars[i].low <= eFast && bars[i].close > eFast;
    const touchedShort = bars[i].high >= eFast && bars[i].close < eFast;
    if (eMid > eSlow && touched) return { side: "long", stopDistancePct: stop, takeProfitR: tp };
    if (eMid < eSlow && touchedShort) return { side: "short", stopDistancePct: stop, takeProfitR: tp };
    return null;
  },

  "rsi-mean-revert-audusd": ({ bars, i, params }) => {
    const closes = closesOf(bars);
    const r = rsi(closes, n(params, "rsiPeriod", 14), i);
    const s = sma(closes, n(params, "smaPeriod", 50), i);
    const a = atr(bars, 14, i);
    if (r == null || s == null || a == null) return null;
    if (Math.abs(closes[i] - s) < a) return null;
    const stop = (a / bars[i].close) * n(params, "stopMult", 1.0);
    const tp = n(params, "takeProfitR", 1.4);
    if (r < n(params, "low", 28)) return { side: "long", stopDistancePct: stop, takeProfitR: tp };
    if (r > n(params, "high", 72)) return { side: "short", stopDistancePct: stop, takeProfitR: tp };
    return null;
  },

  "ny-open-drive-nas100": ({ bars, i, params }) => {
    const hour = utcHour(bars[i].time);
    const min = new Date(bars[i].time).getUTCMinutes();
    const mins = hour * 60 + min;
    if (mins < 13 * 60 + 30 || mins > 14 * 60 + 30) return null;
    if (i < 3) return null;
    const up =
      bars[i].close > bars[i - 1].close &&
      bars[i - 1].close > bars[i - 2].close &&
      bars[i - 2].close > bars[i - 3].close;
    const down =
      bars[i].close < bars[i - 1].close &&
      bars[i - 1].close < bars[i - 2].close &&
      bars[i - 2].close < bars[i - 3].close;
    const a = atr(bars, 14, i);
    if (a == null) return null;
    const stop = (a / bars[i].close) * n(params, "stopMult", 1.1);
    const tp = n(params, "takeProfitR", 1.8);
    if (up) return { side: "long", stopDistancePct: stop, takeProfitR: tp };
    if (down) return { side: "short", stopDistancePct: stop, takeProfitR: tp };
    return null;
  },

  "bollinger-squeeze-usdcad": ({ bars, i, params }) => {
    const period = n(params, "atrPeriod", 14);
    const a = atr(bars, period, i);
    if (a == null) return null;
    const compress = n(params, "compressLookback", 20);
    if (!atrIsCompressing(bars, period, compress, i)) return null;
    const br = n(params, "breakLookback", 10);
    const hh = highest(bars.map((b) => b.high), br, i - 1);
    const ll = lowest(bars.map((b) => b.low), br, i - 1);
    if (hh == null || ll == null) return null;
    const stop = (a / bars[i].close) * n(params, "stopMult", 1.2);
    const tp = n(params, "takeProfitR", 2.0);
    if (bars[i].close > hh) return { side: "long", stopDistancePct: stop, takeProfitR: tp };
    if (bars[i].close < ll) return { side: "short", stopDistancePct: stop, takeProfitR: tp };
    return null;
  },

  "friday-fade-eurusd": ({ bars, i, params }) => {
    if (utcDay(bars[i].time) !== 5 || utcHour(bars[i].time) < 15) return null;
    const closes = closesOf(bars);
    const s = sma(closes, n(params, "smaPeriod", 64), i);
    const a = atr(bars, 14, i);
    if (s == null || a == null) return null;
    const dist = closes[i] - s;
    if (Math.abs(dist) < a * n(params, "atrMult", 1.5)) return null;
    const stop = (a / bars[i].close) * n(params, "stopMult", 0.9);
    const tp = n(params, "takeProfitR", 1.2);
    return dist > 0
      ? { side: "short", stopDistancePct: stop, takeProfitR: tp }
      : { side: "long", stopDistancePct: stop, takeProfitR: tp };
  },

  "overnight-gap-fill-us500": ({ bars, i, params }) => {
    const hour = utcHour(bars[i].time);
    const min = new Date(bars[i].time).getUTCMinutes();
    if (!(hour === 13 && min >= 30) && !(hour === 14 && min === 0)) return null;
    const a = atr(bars, 14, i);
    if (a == null || i < 1) return null;
    const gap = bars[i].open - bars[i - 1].close;
    if (Math.abs(gap) < a * n(params, "gapAtr", 0.4)) return null;
    const stop = (a / bars[i].close) * n(params, "stopMult", 1.0);
    const tp = n(params, "takeProfitR", 1.3);
    return gap > 0
      ? { side: "short", stopDistancePct: stop, takeProfitR: tp }
      : { side: "long", stopDistancePct: stop, takeProfitR: tp };
  },

  "donchian-trend-xau": ({ bars, i, params }) => {
    const channel = n(params, "channel", 20);
    const hh = highest(bars.map((b) => b.high), channel, i - 1);
    const ll = lowest(bars.map((b) => b.low), channel, i - 1);
    const a = atr(bars, 14, i);
    if (hh == null || ll == null || a == null) return null;
    const stop = (a / bars[i].close) * n(params, "stopMult", 1.5);
    const tp = n(params, "takeProfitR", 3.0);
    if (bars[i].close > hh) return { side: "long", stopDistancePct: stop, takeProfitR: tp };
    if (bars[i].close < ll) return { side: "short", stopDistancePct: stop, takeProfitR: tp };
    return null;
  },

  "session-vwap-reversion-gbpusd": ({ bars, i, params }) => {
    const typical = bars.map((b) => (b.high + b.low + b.close) / 3);
    const mid = sma(typical, n(params, "midPeriod", 20), i);
    const a = atr(bars, 14, i);
    const r = rsi(closesOf(bars), 14, i);
    if (mid == null || a == null || r == null) return null;
    const dist = bars[i].close - mid;
    if (Math.abs(dist) < a * n(params, "atrMult", 1.2)) return null;
    const stop = (a / bars[i].close) * n(params, "stopMult", 1.0);
    const tp = n(params, "takeProfitR", 1.5);
    if (dist > 0 && r > 60) return { side: "short", stopDistancePct: stop, takeProfitR: tp };
    if (dist < 0 && r < 40) return { side: "long", stopDistancePct: stop, takeProfitR: tp };
    return null;
  },

  "macd-cross-nzdusd": ({ bars, i, params }) => {
    const closes = closesOf(bars);
    const fast = ema(closes, n(params, "fast", 12), i);
    const slow = ema(closes, n(params, "slow", 26), i);
    const prevFast = ema(closes, n(params, "fast", 12), i - 1);
    const prevSlow = ema(closes, n(params, "slow", 26), i - 1);
    const trend = ema(closes, n(params, "trend", 100), i);
    const prevTrend = ema(closes, n(params, "trend", 100), i - 1);
    const a = atr(bars, 14, i);
    if ([fast, slow, prevFast, prevSlow, trend, prevTrend, a].some((x) => x == null)) return null;
    const stop = (a! / bars[i].close) * n(params, "stopMult", 1.2);
    const tp = n(params, "takeProfitR", 2.0);
    const bull = prevFast! <= prevSlow! && fast! > slow! && trend! >= prevTrend!;
    const bear = prevFast! >= prevSlow! && fast! < slow! && trend! <= prevTrend!;
    if (bull) return { side: "long", stopDistancePct: stop, takeProfitR: tp };
    if (bear) return { side: "short", stopDistancePct: stop, takeProfitR: tp };
    return null;
  },

  "range-fade-usdjpy": ({ bars, i, params }) => {
    const a = atr(bars, 14, i);
    const aSma = atrSma(bars, 14, 20, i);
    if (a == null || aSma == null || a >= aSma) return null;
    const lookback = n(params, "lookback", 20);
    const hh = highest(bars.map((b) => b.high), lookback, i);
    const ll = lowest(bars.map((b) => b.low), lookback, i);
    if (hh == null || ll == null) return null;
    const stop = (a / bars[i].close) * n(params, "stopMult", 0.8);
    const tp = n(params, "takeProfitR", 1.2);
    if (bars[i].high >= hh) return { side: "short", stopDistancePct: stop, takeProfitR: tp };
    if (bars[i].low <= ll) return { side: "long", stopDistancePct: stop, takeProfitR: tp };
    return null;
  },

  "breakout-retest-audusd": ({ bars, i, params }) => {
    const level = n(params, "level", 24);
    const retestBars = n(params, "retestBars", 8);
    const hh = highest(bars.map((b) => b.high), level, i - retestBars - 1);
    const ll = lowest(bars.map((b) => b.low), level, i - retestBars - 1);
    const a = atr(bars, 14, i);
    if (hh == null || ll == null || a == null || i < retestBars + level) return null;
    let brokeUp = false;
    let brokeDown = false;
    for (let j = i - retestBars; j < i; j++) {
      if (bars[j].close > hh) brokeUp = true;
      if (bars[j].close < ll) brokeDown = true;
    }
    const stop = (a / bars[i].close) * n(params, "stopMult", 1.0);
    const tp = n(params, "takeProfitR", 2.0);
    if (brokeUp && bars[i].low <= hh && bars[i].close > hh) {
      return { side: "long", stopDistancePct: stop, takeProfitR: tp };
    }
    if (brokeDown && bars[i].high >= ll && bars[i].close < ll) {
      return { side: "short", stopDistancePct: stop, takeProfitR: tp };
    }
    return null;
  },

  "crypto-vol-trend-btc": ({ bars, i, params }) => {
    const closes = closesOf(bars);
    const eFast = ema(closes, n(params, "fast", 20), i);
    const eSlow = ema(closes, n(params, "slow", 50), i);
    const a = atr(bars, 14, i);
    const aPrev = atr(bars, 14, i - 10);
    if (eFast == null || eSlow == null || a == null || aPrev == null) return null;
    if (a <= aPrev) return null;
    const stop = (a / bars[i].close) * n(params, "stopMult", 1.8);
    const tp = n(params, "takeProfitR", 2.8);
    if (eFast > eSlow && bars[i].close > eFast) {
      return { side: "long", stopDistancePct: stop, takeProfitR: tp };
    }
    if (eFast < eSlow && bars[i].close < eFast) {
      return { side: "short", stopDistancePct: stop, takeProfitR: tp };
    }
    return null;
  },

  "monday-gap-continuation-de40": ({ bars, i, params }) => {
    if (utcDay(bars[i].time) !== 1) return null;
    const hour = utcHour(bars[i].time);
    if (hour < 8 || hour > 11) return null;
    // Impulse from ~07:00 window
    let openBar: number | null = null;
    for (let j = i; j >= Math.max(0, i - 40); j--) {
      if (utcDay(bars[j].time) === 1 && utcHour(bars[j].time) === 7) {
        openBar = j;
        break;
      }
    }
    if (openBar == null) return null;
    const impulse = bars[openBar + 3]?.close - bars[openBar].open;
    if (!impulse || Math.abs(impulse) / bars[i].close < 0.0008) return null;
    const mid = sma(
      bars.map((b) => (b.high + b.low + b.close) / 3),
      12,
      i,
    );
    const a = atr(bars, 14, i);
    if (mid == null || a == null) return null;
    const stop = (a / bars[i].close) * n(params, "stopMult", 1.1);
    const tp = n(params, "takeProfitR", 1.9);
    if (impulse > 0 && bars[i].low <= mid && bars[i].close >= mid) {
      return { side: "long", stopDistancePct: stop, takeProfitR: tp };
    }
    if (impulse < 0 && bars[i].high >= mid && bars[i].close <= mid) {
      return { side: "short", stopDistancePct: stop, takeProfitR: tp };
    }
    return null;
  },
};

export function listStrategies(): StrategyTemplate[] {
  return STRATEGY_TEMPLATES;
}

export function getStrategy(id: string): StrategyTemplate | undefined {
  return STRATEGY_TEMPLATES.find((s) => s.id === id);
}
