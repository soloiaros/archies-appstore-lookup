import { runRevenueEstimates } from "../lib/pipeline/revenue";

function main(): void {
  const result = runRevenueEstimates();

  console.log(
    JSON.stringify(result),
  );

  if (result.skipped) {
    process.exitCode = 1;
  }
}

main();
