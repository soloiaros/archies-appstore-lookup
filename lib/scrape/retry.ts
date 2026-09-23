const RETRY_WAITS_MS = [
  1000,
  2000,
  4000,
];

export function sleep(
  ms: number,
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(
      resolve,
      ms,
    );
  });
}

export async function withHttpRetry(
  run: () => Promise<Response>,
): Promise<Response> {
  let lastError: unknown;

  for (
    let attempt = 0;
    attempt <= RETRY_WAITS_MS.length;
    attempt += 1
  ) {
    try {
      const response = await run();

      const retryable =
        response.status === 429
        || response.status === 403
        || response.status >= 500;

      if (!retryable) {
        return response;
      }

      lastError = new Error(
        `HTTP ${response.status}`,
      );
    } catch (error) {
      lastError = error;
    }

    const wait = RETRY_WAITS_MS[attempt];

    if (wait === undefined) {
      break;
    }

    await sleep(wait);
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error(
    "request failed",
  );
}
