# Strategy Lab

Open strategy portfolio lab with **19 readable templates**, OHLC backtests (commission + spread + swap), correlation pruning, paper deploy, and an **MCP server** so Cursor / Claude can run the same five-step workflow.

## Quick start

```bash
npm install
npm run dev          # UI at http://localhost:3000
npm run smoke        # run the full workflow headlessly
npm run mcp          # start MCP (stdio)
```

## MCP tools

| Tool | Maps to |
|---|---|
| `list_strategies` | What strategies do I already have? |
| `backtest_all` | Backtest all 19 · 5 years · real costs |
| `build_portfolio` | Put profitable ones in a portfolio |
| `prune_correlated` | Which are too alike? Keep the better |
| `deploy_paper` | Deploy on demo account |
| `run_reel_workflow` | All five in order |

Connect with [`mcp.json.example`](./mcp.json.example).

## Honest limits

- Market data is **deterministic synthetic OHLC**, not broker tick data.
- Paper deploy is **local**, not IC Markets / FP Markets.
- Templates are **starting points**, not trading advice.

## Stack

Next.js · TypeScript · Zod · `@modelcontextprotocol/sdk`
