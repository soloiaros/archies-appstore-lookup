import {
  mkdirSync,
  writeFileSync,
} from "node:fs";

import { join } from "node:path";

export type PollStatus = {
  ok: boolean;

  at: string;

  detail: string;
};

export function reportPoll(
  status: PollStatus,
): void {
  const dir = join(
    process.cwd(),
    "data",
    "snapshots",
  );

  mkdirSync(
    dir,
    {
      recursive: true,
    },
  );

  writeFileSync(
    join(
      dir,
      "poll-status.json",
    ),
    JSON.stringify(
      status,
      null,
      2,
    ),
  );

  if (!status.ok) {
    console.error(status.detail);
  }
}
