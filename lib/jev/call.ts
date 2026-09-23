import { typesafeKey } from "@/lib/env";

const ENDPOINT =
  "https://api.typesafe.ai/v1/systemone";

export async function systemOne<T>(
  body: Record<string, unknown>,
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
): Promise<T | null> {
  const key = typesafeKey();

  if (!key) {
    return null;
  }

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
        return (await response.json()) as T;
      }

      if (
        response.status !== 429
        && response.status < 500
      ) {
        return null;
      }
    } catch {
      if (performance.now() - started > 2000) {
        return null;
      }
    }
  }

  return null;
}
