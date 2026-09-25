import { NextResponse } from "next/server";

import sharp from "sharp";

import { openCatalog } from "@/lib/scrape/store";

export const runtime = "nodejs";

const SIZE = 128;

type Params = {
  params: Promise<{
    trackId: string;
  }>;
};

export async function GET(_request: Request, { params }: Params) {
  const { trackId: raw } = await params;
  const trackId = Number(raw);

  if (!Number.isFinite(trackId) || trackId <= 0) {
    return NextResponse.json({ error: "bad trackId" }, { status: 400 });
  }

  const db = openCatalog();

  let iconUrl = "";

  try {
    const row = db
      .prepare(
        `
        select icon_url as iconUrl
        from apps
        where track_id = ?
          and delisted = 0
          and icon_url != ''
        limit 1
      `,
      )
      .get(trackId) as { iconUrl: string } | undefined;

    iconUrl = row ? String(row.iconUrl) : "";
  } finally {
    db.close();
  }

  if (!iconUrl) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const thumb = iconUrl.replace(
    /\/\d+x\d+bb\.(jpg|png|webp|jpeg)$/i,
    `/${SIZE}x${SIZE}bb.png`,
  );

  try {
    const upstream = await fetch(thumb, {
      headers: {
        Accept: "image/*",
      },
      next: { revalidate: 86400 },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `upstream ${upstream.status}` },
        { status: 502 },
      );
    }

    const input = Buffer.from(await upstream.arrayBuffer());

    const png = await sharp(input)
      .resize(SIZE, SIZE, { fit: "cover" })
      .png()
      .toBuffer();

    return new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err) {
    console.error("vending icon proxy failed", trackId, err);
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }
}
