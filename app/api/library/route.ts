import { NextResponse } from "next/server";

import { sampleIconUrls } from "@/lib/catalog/sample";

import { openCatalog } from "@/lib/scrape/store";

import { catalogDb } from "@/lib/site/db";

export const runtime = "nodejs";

export async function GET(
  request: Request,
) {
  const url = new URL(request.url);

  const sample = Math.min(
    40,
    Math.max(
      1,
      Number(url.searchParams.get("sample") ?? "16")
      || 16,
    ),
  );

  const remote = await catalogDb();

  if (remote) {
    const srcs = await sampleIconUrls(remote, sample);

    return NextResponse.json({
      srcs,
    });
  }

  const db = openCatalog();

  try {
    const rows = db.prepare(`
      select icon_url as src
      from apps
      where icon_url != ''
        and delisted = 0
      order by random()
      limit ?
    `).all(sample) as Array<{
      src: string;
    }>;

    return NextResponse.json({
      srcs: rows.map((row) => String(row.src)),
    });
  } finally {
    db.close();
  }
}
