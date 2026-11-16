#!/usr/bin/env node
/**
 * Strategy Lab MCP server — stdio transport.
 * Connect from Cursor / Claude Desktop with:
 *   { "command": "npx", "args": ["tsx", "src/mcp/server.ts"], "cwd": "<this-repo>" }
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  backtestAllStrategies,
  backtestOne,
  deployPaperDemo,
  pruneAlikePairs,
  putProfitableInPortfolio,
  runFullWorkflow,
  whatStrategiesDoIHave,
} from "../lib/workflow";
import { getSummary, loadState } from "../lib/store/state";
import { getStrategy, listStrategies } from "../lib/strategies/templates";

function text(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

const server = new McpServer({
  name: "strategy-lab",
  version: "0.1.0",
});

server.tool(
  "list_strategies",
  "List the 19 open strategy templates you already have (what strategies do I already have?).",
  async () => text(whatStrategiesDoIHave()),
);

server.tool(
  "get_strategy",
  "Read one strategy template: rules, params, instrument, timeframe.",
  { strategyId: z.string() },
  async ({ strategyId }) => {
    const s = getStrategy(strategyId);
    if (!s) return text({ error: `Unknown strategy ${strategyId}` });
    return text(s);
  },
);

server.tool(
  "backtest_all",
  "Backtest all 19 strategies over N years with real costs (commission, spread, swap). OHLC demo mode.",
  {
    years: z.number().min(1).max(20).optional(),
    commissionPct: z.number().optional(),
    spreadPct: z.number().optional(),
    swapPctPerDay: z.number().optional(),
  },
  async ({ years, commissionPct, spreadPct, swapPctPerDay }) =>
    text(
      backtestAllStrategies({
        years: years ?? 5,
        costs: {
          ...(commissionPct != null ? { commissionPct } : {}),
          ...(spreadPct != null ? { spreadPct } : {}),
          ...(swapPctPerDay != null ? { swapPctPerDay } : {}),
        },
      }),
    ),
);

server.tool(
  "backtest_one",
  "Backtest a single strategy by id.",
  {
    strategyId: z.string(),
    years: z.number().min(1).max(20).optional(),
  },
  async ({ strategyId, years }) => text(backtestOne(strategyId, years ?? 5)),
);

server.tool(
  "build_portfolio",
  "Put the profitable strategies into a portfolio (equal weight).",
  async () => text(putProfitableInPortfolio()),
);

server.tool(
  "prune_correlated",
  "Which ones are too alike? Keep the better of each highly correlated pair.",
  {
    threshold: z.number().min(0.1).max(0.99).optional(),
  },
  async ({ threshold }) => text(pruneAlikePairs(threshold ?? 0.72)),
);

server.tool(
  "deploy_paper",
  "Deploy the current portfolio on a local demo/paper account.",
  {
    balance: z.number().positive().optional(),
    name: z.string().optional(),
  },
  async ({ balance, name }) =>
    text(
      deployPaperDemo({
        balance: balance ?? 10_000,
        name: name ?? "Demo Account",
      }),
    ),
);

server.tool(
  "run_reel_workflow",
  "Run the full Instagram 5-step workflow in order: list → backtest all → portfolio → prune alike → deploy demo.",
  async () => text(runFullWorkflow()),
);

server.tool(
  "lab_status",
  "Summary of backtests, portfolio, and paper deployment state.",
  async () => text({ summary: getSummary(), state: loadState() }),
);

server.tool(
  "catalog",
  "Raw catalog of template ids and names.",
  async () =>
    text(
      listStrategies().map((s) => ({
        id: s.id,
        name: s.name,
        instrument: s.instrument,
        timeframe: s.timeframe,
        category: s.category,
      })),
    ),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
