export type D1Row = Record<string, unknown>;

type D1Result<T> = {
  success: boolean;
  results: T[];
  meta?: {
    rows_read?: number;
    rows_written?: number;
    size_after?: number;
  };
};

type D1Response<T> = {
  success: boolean;
  result?: Array<D1Result<T>>;
  errors?: Array<{ message?: string }>;
};

export class D1Sync {
  private readonly endpoint: string;

  readonly usage = { rowsRead: 0, rowsWritten: 0, sizeAfter: 0, calls: 0 };

  // Deliberately below this account's included D1 monthly usage and storage.
  private readonly maxRowsWritten = 1_000_000;

  private readonly maxDatabaseBytes = 1_000_000_000;

  constructor(
    accountId: string,
    databaseId: string,
    private readonly token: string,
  ) {
    if (!/^[0-9a-f]{32}$/i.test(accountId)
      || !/^[0-9a-f-]{36}$/i.test(databaseId)
      || !token) {
      throw new Error("Cloudflare D1 credentials are missing or invalid");
    }

    this.endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  }

  async query<T extends D1Row = D1Row>(
    sql: string,
    params: string[] = [],
  ): Promise<T[]> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      let response: Response;

      try {
        response = await fetch(this.endpoint, {
          method: "POST",
          headers: {
            authorization: `Bearer ${this.token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ sql, params }),
          signal: AbortSignal.timeout(30_000),
        });
      } catch (error) {
        if (attempt === 4) throw error;
        await delay(500 * 2 ** attempt);
        continue;
      }

      if ((response.status === 429 || response.status >= 500) && attempt < 4) {
        const retryAfter = Number(response.headers.get("retry-after"));
        await delay(Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 30_000)
          : 500 * 2 ** attempt);
        continue;
      }

      const payload = await response.json() as D1Response<T>;
      const result = payload.result?.[0];

      if (!response.ok || !payload.success || !result?.success) {
        const detail = payload.errors?.map((item) => item.message).filter(Boolean).join("; ")
          || `HTTP ${response.status}`;
        throw new Error(`D1 query failed: ${detail}`);
      }

      this.usage.calls += 1;
      this.usage.rowsRead += result.meta?.rows_read ?? 0;
      this.usage.rowsWritten += result.meta?.rows_written ?? 0;
      this.usage.sizeAfter = result.meta?.size_after ?? this.usage.sizeAfter;
      return result.results ?? [];
    }

    throw new Error("D1 query retry limit reached");
  }

  async all<T extends D1Row>(
    sql: string,
    pageSize = 1000,
  ): Promise<T[]> {
    const rows: T[] = [];
    let after = 0;

    for (;;) {
      const page = await this.query<T>(sql, [String(after), String(pageSize)]);
      rows.push(...page);
      if (page.length < pageSize) return rows;
      const last = Number(page.at(-1)?.track_id);
      if (!Number.isSafeInteger(last) || last <= after) {
        throw new Error("D1 pagination did not advance");
      }
      after = last;
    }
  }

  async writeRows(sql: string, rows: D1Row[]): Promise<number> {
    const before = this.usage.rowsWritten;
    for (const chunk of jsonChunks(rows)) {
      this.assertBudget();
      await this.query(sql, [JSON.stringify(chunk)]);
      // Keep each D1 write short and leave room for app requests.
      await delay(50);
    }
    return this.usage.rowsWritten - before;
  }

  assertBudget(): void {
    if (this.usage.rowsWritten >= this.maxRowsWritten
      || this.usage.sizeAfter >= this.maxDatabaseBytes) {
      throw new Error(`D1 sync budget reached: ${JSON.stringify(this.usage)}`);
    }
  }
}

export function jsonChunks(
  rows: D1Row[],
  maxRows = 25,
  maxBytes = 80_000,
): D1Row[][] {
  const chunks: D1Row[][] = [];
  let chunk: D1Row[] = [];
  let bytes = 2;

  for (const row of rows) {
    const rowBytes = Buffer.byteLength(JSON.stringify(row), "utf8") + 1;
    if (rowBytes > maxBytes) {
      throw new Error("A catalog row exceeds the D1 batch size limit");
    }
    if (chunk.length > 0 && (chunk.length >= maxRows || bytes + rowBytes > maxBytes)) {
      chunks.push(chunk);
      chunk = [];
      bytes = 2;
    }
    chunk.push(row);
    bytes += rowBytes;
  }

  if (chunk.length > 0) chunks.push(chunk);
  return chunks;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
