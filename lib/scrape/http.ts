import { withHttpRetry } from "@/lib/scrape/retry";

const HEADERS = {
  accept: "application/json",
  "user-agent": "AppStoreIndexor/0.1",
};

export async function getJson(
  url: string,
): Promise<unknown> {
  const response = await withHttpRetry(
    () => fetch(
      url,
      {
        headers: HEADERS,
      },
    ),
  );

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${url}`,
    );
  }

  const text = await response.text();

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(
      `invalid json ${url}`,
    );
  }
}
