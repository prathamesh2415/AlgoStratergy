import { runFullWorkflow } from "../src/lib/workflow";

const result = runFullWorkflow();
console.log(JSON.stringify(result.summary, null, 2));
