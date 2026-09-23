import {
  isStale,
  METADATA_MAX_AGE_MS,
} from "../lib/provenance/staleness";

function assert(
  condition: boolean,
  message: string,
): void {
  if (!condition) {
    throw new Error(message);
  }
}

const fresh = new Date().toISOString();

const old = new Date(
  Date.now() - METADATA_MAX_AGE_MS - 1000,
).toISOString();

assert(
  !isStale(fresh, METADATA_MAX_AGE_MS),
  "fresh should not be stale",
);

assert(
  isStale(old, METADATA_MAX_AGE_MS),
  "old should be stale",
);

assert(
  isStale("not-a-date", METADATA_MAX_AGE_MS),
  "invalid date is stale",
);

console.log(
  JSON.stringify({
    ok: true,
    thresholdMs: METADATA_MAX_AGE_MS,
  }),
);
