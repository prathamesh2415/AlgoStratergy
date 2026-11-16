import {
  backtestAllStrategies,
  deployPaperDemo,
  pruneAlikePairs,
  putProfitableInPortfolio,
  whatStrategiesDoIHave,
} from "../src/lib/workflow";

function main() {
  const listed = whatStrategiesDoIHave();
  console.log(`strategies=${listed.count}`);
  const bt = backtestAllStrategies({ years: 5 });
  console.log(
    `backtested=${bt.results.length} profitable=${bt.profitableIds.length}`,
  );
  const pf = putProfitableInPortfolio();
  console.log(`portfolio_pre_prune=${pf.portfolio.members.length}`);
  const pruned = pruneAlikePairs(0.72);
  console.log(
    `portfolio_final=${pruned.portfolio.members.length} pairs=${pruned.prunedPairs.length}`,
  );
  const demo = deployPaperDemo({ balance: 10_000 });
  console.log(
    `paper=${demo.paper.id} members=${demo.paper.members.length} status=${demo.paper.status}`,
  );
  console.log("SMOKE_OK");
}

main();
