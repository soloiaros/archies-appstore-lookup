import { typesafeKey } from "@/lib/env";

const ENDPOINT =
  "https://openrouter.ai/api/v1/systemone";

export type SystemOneFailure =
  | "missing-key"
  | "rejected"
  | "unavailable";

export type SystemOneResult<T> =
  | {
      ok: true;

      data: T;
    }
  | {
      ok: false;

      reason: SystemOneFailure;
    };

export async function systemOne<T>(
  body: Record<string, unknown>,
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
): Promise<SystemOneResult<T>> {
  const key = typesafeKey();

  if (!key) {
    return {
      ok: false,
      reason: "missing-key",
    };
  }

  let rejected = false;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const started = performance.now();

    try {
      const response = await fetchImpl(
        ENDPOINT,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${key}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: "jev-latest",
            ...body,
          }),
          signal: AbortSignal.timeout(timeoutMs),
        },
      );

      if (response.ok) {
        return {
          ok: true,
          data: (await response.json()) as T,
        };
      }

      if (response.status === 401) {
        rejected = true;

        break;
      }

      if (
        response.status !== 429
        && response.status < 500
      ) {
        return {
          ok: false,
          reason: "unavailable",
        };
      }
    } catch {
      if (performance.now() - started > 2000) {
        return {
          ok: false,
          reason: "unavailable",
        };
      }
    }
  }

  return {
    ok: false,
    reason: rejected
      ? "rejected"
      : "unavailable",
  };
}
