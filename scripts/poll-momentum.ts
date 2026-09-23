import { reportPoll } from "../lib/pipeline/monitor";

async function main(): Promise<void> {
  // TODO(phase-3)

  reportPoll(false);

  console.error(
    "poll-momentum: not wired",
  );

  process.exitCode = 1;
}

void main();
