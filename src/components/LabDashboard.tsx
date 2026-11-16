"use client";

import { useEffect, useState, useTransition } from "react";

type StrategyRow = {
  id: string;
  name: string;
  instrument: string;
  timeframe: string;
  category: string;
  description: string;
  rules: string[];
  backtested: boolean;
  profitable: boolean | null;
};

type Metrics = {
  trades: number;
  winRate: number;
  netPnl: number;
  maxDrawdownPct: number;
  sharpe: number;
  profitFactor: number;
  totalCosts: number;
  profitable: boolean;
};

type BacktestRow = {
  strategyId: string;
  name: string;
  instrument: string;
  timeframe: string;
  metrics: Metrics;
};

type Portfolio = {
  id: string;
  members: { strategyId: string; name: string; weight: number; metrics: Metrics }[];
  prunedPairs: {
    a: string;
    b: string;
    correlation: number;
    kept: string;
    dropped: string;
    reason: string;
  }[];
  combined: {
    netPnl: number;
    maxDrawdownPct: number;
    sharpe: number;
    trades: number;
  };
};

type Paper = {
  id: string;
  name: string;
  balance: number;
  equity: number;
  deployedAt: string;
  status: string;
  members: { strategyId: string; name: string }[];
  notes: string;
};

type StatusPayload = {
  summary: {
    strategyCount: number;
    backtested: number;
    profitable: number;
    portfolioSize: number;
    paper: { id: string; status: string; balance: number; equity: number; deployedAt: string } | null;
    lastWorkflowAt: string | null;
  };
  backtests: BacktestRow[];
  portfolio: Portfolio | null;
  paper: Paper | null;
};

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtNum(n: number, d = 2) {
  return n.toFixed(d);
}

export default function LabDashboard() {
  const [strategies, setStrategies] = useState<StrategyRow[]>([]);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<StrategyRow | null>(null);

  async function refresh() {
    const [sRes, stRes] = await Promise.all([
      fetch("/api/strategies"),
      fetch("/api/status"),
    ]);
    if (!sRes.ok || !stRes.ok) throw new Error("Failed to load lab state");
    const sJson = (await sRes.json()) as { strategies: StrategyRow[] };
    const stJson = (await stRes.json()) as StatusPayload;
    setStrategies(sJson.strategies);
    setStatus(stJson);
    if (!selected && sJson.strategies[0]) setSelected(sJson.strategies[0]);
  }

  useEffect(() => {
    startTransition(() => {
      refresh().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pushLog(line: string) {
    setLog((prev) => [line, ...prev].slice(0, 12));
  }

  async function runStep(step: number, fn: () => Promise<void>) {
    setError(null);
    setActiveStep(step);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Step failed");
    } finally {
      setActiveStep(null);
    }
  }

  const steps = [
    {
      id: 1,
      title: "What strategies do I already have?",
      blurb: "Open the 19 templates — every rule readable.",
      action: async () => {
        pushLog(`Listed ${strategies.length || 19} strategy templates.`);
      },
    },
    {
      id: 2,
      title: "Backtest all 19: 5 years, real costs",
      blurb: "OHLC demo with commission, spread, and swap.",
      action: async () => {
        const res = await fetch("/api/backtest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ years: 5 }),
        });
        if (!res.ok) throw new Error("Backtest failed");
        const data = (await res.json()) as { profitableIds: string[] };
        pushLog(
          `Backtested 19 strategies · ${data.profitableIds.length} profitable after costs.`,
        );
      },
    },
    {
      id: 3,
      title: "Put the profitable ones in a portfolio",
      blurb: "Equal-weight the winners.",
      action: async () => {
        const res = await fetch("/api/portfolio", { method: "POST" });
        if (!res.ok) throw new Error("Portfolio build failed");
        const data = (await res.json()) as { portfolio: Portfolio };
        pushLog(`Portfolio built with ${data.portfolio.members.length} members.`);
      },
    },
    {
      id: 4,
      title: "Which ones are too alike?",
      blurb: "Keep the better of each correlated pair.",
      action: async () => {
        const res = await fetch("/api/prune", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ threshold: 0.72 }),
        });
        if (!res.ok) throw new Error("Prune failed");
        const data = (await res.json()) as {
          portfolio: Portfolio;
          prunedPairs: unknown[];
        };
        pushLog(
          `Pruned ${data.prunedPairs.length} alike pair(s) · ${data.portfolio.members.length} remain.`,
        );
      },
    },
    {
      id: 5,
      title: "Deploy on my demo account",
      blurb: "Local paper account — not a live broker.",
      action: async () => {
        const res = await fetch("/api/deploy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ balance: 10000, name: "Demo Account" }),
        });
        if (!res.ok) throw new Error("Deploy failed");
        const data = (await res.json()) as { paper: Paper };
        pushLog(
          `Deployed ${data.paper.members.length} strategies on ${data.paper.name}.`,
        );
      },
    },
  ];

  async function runAll() {
    setError(null);
    setActiveStep(0);
    try {
      const res = await fetch("/api/workflow", { method: "POST" });
      if (!res.ok) throw new Error("Workflow failed");
      const data = (await res.json()) as { durationMs: number; summary: StatusPayload["summary"] };
      pushLog(
        `Full workflow done in ${(data.durationMs / 1000).toFixed(1)}s · portfolio ${data.summary.portfolioSize} · paper ${data.summary.paper?.status ?? "n/a"}.`,
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Workflow failed");
    } finally {
      setActiveStep(null);
    }
  }

  const backtests = status?.backtests ?? [];
  const portfolio = status?.portfolio;
  const paper = status?.paper;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-noise" />

      <header className="relative mx-auto flex max-w-6xl items-end justify-between gap-6 px-6 pb-8 pt-10 md:px-10 md:pt-14">
        <div className="anim-rise">
          <p className="font-display text-4xl font-extrabold tracking-tight text-[var(--ink)] md:text-6xl">
            Strategy Lab
          </p>
          <p className="mt-3 max-w-xl text-base text-[var(--ink-soft)]/80 md:text-lg">
            Nineteen open templates. Backtest with costs. Prune lookalikes. Deploy paper —
            from the UI or your MCP-connected AI.
          </p>
        </div>
        <div className="anim-rise anim-rise-delay-1 hidden text-right sm:block">
          <p className="font-mono-num text-xs uppercase tracking-[0.2em] text-[var(--teal)]">
            MCP ready
          </p>
          <p className="mt-1 font-mono-num text-sm text-[var(--ink-soft)]">
            npx tsx src/mcp/server.ts
          </p>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pb-24 md:px-10">
        <div className="mb-8 h-px w-full bg-[var(--line)]">
          <div className="pulse-line h-px w-2/3 bg-[var(--teal-bright)]" />
        </div>

        <section className="anim-rise anim-rise-delay-2 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-[var(--line)] bg-white/55 p-5 backdrop-blur-sm md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-bold">Five-step workflow</h2>
              <button
                type="button"
                onClick={() => startTransition(() => runAll())}
                disabled={pending || activeStep !== null}
                className="rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--ink-soft)] disabled:opacity-50"
              >
                {activeStep === 0 ? "Running…" : "Run all five"}
              </button>
            </div>
            <ol className="mt-5 space-y-3">
              {steps.map((step) => (
                <li
                  key={step.id}
                  className="flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper)]/80 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-mono-num text-xs text-[var(--teal)]">
                      {String(step.id).padStart(2, "0")}
                    </p>
                    <p className="font-medium text-[var(--ink)]">{step.title}</p>
                    <p className="text-sm text-[var(--ink-soft)]/75">{step.blurb}</p>
                  </div>
                  <button
                    type="button"
                    disabled={pending || activeStep !== null}
                    onClick={() =>
                      startTransition(() => runStep(step.id, step.action))
                    }
                    className="shrink-0 rounded-lg border border-[var(--ink)]/15 bg-white px-3 py-2 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--teal)] hover:text-[var(--teal)] disabled:opacity-50"
                  >
                    {activeStep === step.id ? "Working…" : "Run"}
                  </button>
                </li>
              ))}
            </ol>
            {error && (
              <p className="mt-4 text-sm text-[var(--danger)]" role="alert">
                {error}
              </p>
            )}
            {activeStep !== null && (
              <div className="mt-4 h-1.5 overflow-hidden rounded-full loading-shimmer" />
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-[var(--line)] bg-[var(--ink)] p-5 text-[var(--fog)]">
              <p className="font-mono-num text-xs uppercase tracking-[0.18em] text-[var(--teal-bright)]">
                Lab status
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs text-[var(--mist)]">Templates</dt>
                  <dd className="font-mono-num text-2xl">
                    {status?.summary.strategyCount ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--mist)]">Backtested</dt>
                  <dd className="font-mono-num text-2xl">
                    {status?.summary.backtested ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--mist)]">Profitable</dt>
                  <dd className="font-mono-num text-2xl text-[var(--teal-bright)]">
                    {status?.summary.profitable ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--mist)]">Portfolio</dt>
                  <dd className="font-mono-num text-2xl">
                    {status?.summary.portfolioSize ?? "—"}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-sm text-[var(--mist)]">
                Paper:{" "}
                <span className="text-[var(--fog)]">
                  {paper
                    ? `${paper.name} · ${paper.status} · ${fmtMoney(paper.equity)}`
                    : "not deployed"}
                </span>
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--line)] bg-white/55 p-5 backdrop-blur-sm">
              <p className="font-display text-lg font-bold">Activity</p>
              {log.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--ink-soft)]/70">
                  Run a step to see results here.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {log.map((line, i) => (
                    <li
                      key={`${i}-${line.slice(0, 12)}`}
                      className="border-l-2 border-[var(--teal)] pl-3 text-sm text-[var(--ink-soft)]"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </section>

        <section className="anim-rise anim-rise-delay-3 mt-12 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="font-display text-2xl font-bold">Templates</h2>
            <p className="mt-1 text-sm text-[var(--ink-soft)]/75">
              Click one to read every rule.
            </p>
            <ul className="mt-4 max-h-[28rem] space-y-2 overflow-auto pr-1">
              {strategies.map((s) => {
                const bt = backtests.find((b) => b.strategyId === s.id);
                const active = selected?.id === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(s)}
                      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                        active
                          ? "border-[var(--teal)] bg-white shadow-[0_0_0_3px_var(--glow)]"
                          : "border-[var(--line)] bg-white/50 hover:border-[var(--teal)]/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{s.name}</p>
                          <p className="font-mono-num text-xs text-[var(--ink-soft)]/70">
                            {s.instrument} · {s.timeframe} · {s.category}
                          </p>
                        </div>
                        {bt && (
                          <span
                            className={`font-mono-num text-xs ${
                              bt.metrics.profitable
                                ? "text-[var(--ok)]"
                                : "text-[var(--danger)]"
                            }`}
                          >
                            {fmtMoney(bt.metrics.netPnl)}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
              {strategies.length === 0 && (
                <li className="text-sm text-[var(--ink-soft)]/70">Loading templates…</li>
              )}
            </ul>
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-white/60 p-5 backdrop-blur-sm md:p-6">
            {selected ? (
              <>
                <p className="font-mono-num text-xs uppercase tracking-[0.16em] text-[var(--amber)]">
                  {selected.category}
                </p>
                <h3 className="font-display mt-1 text-3xl font-bold">{selected.name}</h3>
                <p className="mt-2 text-[var(--ink-soft)]/80">{selected.description}</p>
                <p className="mt-3 font-mono-num text-sm text-[var(--ink-soft)]">
                  {selected.instrument} · {selected.timeframe} · id:{selected.id}
                </p>
                <h4 className="mt-6 text-sm font-semibold uppercase tracking-wide text-[var(--ink)]">
                  Rules
                </h4>
                <ul className="mt-2 space-y-2">
                  {selected.rules.map((rule) => (
                    <li
                      key={rule}
                      className="rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm"
                    >
                      {rule}
                    </li>
                  ))}
                </ul>
                {(() => {
                  const bt = backtests.find((b) => b.strategyId === selected.id);
                  if (!bt) {
                    return (
                      <p className="mt-6 text-sm text-[var(--ink-soft)]/70">
                        Not backtested yet — run step 02.
                      </p>
                    );
                  }
                  return (
                    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {[
                        ["Net PnL", fmtMoney(bt.metrics.netPnl)],
                        ["Trades", String(bt.metrics.trades)],
                        ["Win rate", fmtPct(bt.metrics.winRate)],
                        ["Max DD", `${fmtNum(bt.metrics.maxDrawdownPct, 1)}%`],
                        ["Sharpe", fmtNum(bt.metrics.sharpe)],
                        ["Costs", fmtMoney(bt.metrics.totalCosts)],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2"
                        >
                          <p className="text-xs text-[var(--ink-soft)]/70">{label}</p>
                          <p className="font-mono-num text-lg">{value}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </>
            ) : (
              <p className="text-sm text-[var(--ink-soft)]/70">Select a template.</p>
            )}
          </div>
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--line)] bg-white/55 p-5 backdrop-blur-sm">
            <h2 className="font-display text-2xl font-bold">Portfolio</h2>
            {!portfolio || portfolio.members.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--ink-soft)]/70">
                Build and prune to populate this view.
              </p>
            ) : (
              <>
                <p className="mt-2 font-mono-num text-sm text-[var(--ink-soft)]">
                  {portfolio.members.length} members · combined{" "}
                  {fmtMoney(portfolio.combined.netPnl)} · DD{" "}
                  {fmtNum(portfolio.combined.maxDrawdownPct, 1)}%
                </p>
                <ul className="mt-4 space-y-2">
                  {portfolio.members.map((m) => (
                    <li
                      key={m.strategyId}
                      className="flex items-center justify-between rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
                    >
                      <span>{m.name}</span>
                      <span className="font-mono-num text-[var(--ink-soft)]">
                        {(m.weight * 100).toFixed(0)}% · {fmtMoney(m.metrics.netPnl)}
                      </span>
                    </li>
                  ))}
                </ul>
                {portfolio.prunedPairs.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold">Alike pairs pruned</p>
                    <ul className="mt-2 space-y-1 text-xs text-[var(--ink-soft)]">
                      {portfolio.prunedPairs.map((p) => (
                        <li key={`${p.a}-${p.b}`}>
                          {p.dropped} dropped vs {p.kept} (corr {fmtNum(p.correlation)})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--line)] bg-white/55 p-5 backdrop-blur-sm">
            <h2 className="font-display text-2xl font-bold">Demo account</h2>
            {!paper ? (
              <p className="mt-3 text-sm text-[var(--ink-soft)]/70">
                Deploy step 05 to start the paper account.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-[var(--ink-soft)]">{paper.notes}</p>
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-xs text-[var(--ink-soft)]/70">Account</dt>
                    <dd className="font-medium">{paper.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--ink-soft)]/70">Status</dt>
                    <dd className="font-mono-num text-[var(--ok)]">{paper.status}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--ink-soft)]/70">Balance</dt>
                    <dd className="font-mono-num">{fmtMoney(paper.balance)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--ink-soft)]/70">Strategies</dt>
                    <dd className="font-mono-num">{paper.members.length}</dd>
                  </div>
                </dl>
                <p className="mt-3 font-mono-num text-xs text-[var(--ink-soft)]/70">
                  Deployed {new Date(paper.deployedAt).toLocaleString("en-IN", { timeZone: "Asia/Calcutta" })}{" "}
                  (Asia/Calcutta)
                </p>
              </>
            )}
          </div>
        </section>

        <section className="mt-12 rounded-2xl border border-[var(--line)] bg-[var(--ink)] p-6 text-[var(--fog)] md:p-8">
          <h2 className="font-display text-2xl font-bold text-white">Connect MCP</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--mist)]">
            Add this server in Cursor or Claude Desktop, then send the five prompts in order —
            or call <span className="font-mono-num text-[var(--teal-bright)]">run_reel_workflow</span>.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-black/35 p-4 font-mono-num text-xs leading-relaxed text-[var(--fog)]">
{`{
  "mcpServers": {
    "strategy-lab": {
      "command": "npx",
      "args": ["tsx", "src/mcp/server.ts"],
      "cwd": "/absolute/path/to/strategy-lab"
    }
  }
}`}
          </pre>
        </section>
      </main>
    </div>
  );
}
