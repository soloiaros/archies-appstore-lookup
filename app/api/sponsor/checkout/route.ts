import { NextResponse } from "next/server";

import { formatPrice, sponsorPriceCents } from "@/lib/site/price";

import {
  attachCheckout,
  holdSlot,
  releaseHold,
} from "@/lib/site/slots";

import { createCheckout } from "@/lib/site/stripe";

export const dynamic = "force-dynamic";

type Body = {
  slotId?: unknown;

  name?: unknown;

  url?: unknown;

  blurb?: unknown;

  logoUrl?: unknown;

  color?: unknown;
};

function text(value: unknown, max: number) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.replace(/\s+/g, " ").trim();

  if (!trimmed || trimmed.length > max) {
    return null;
  }

  return trimmed;
}

function publicUrl(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value.trim());

    if (url.protocol !== "https:") {
      return null;
    }

    return url.href.slice(0, 300);
  } catch {
    return null;
  }
}

function logo(value: unknown) {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  if (value.startsWith("/") && !value.startsWith("//") && value.length < 200) {
    return value;
  }

  return publicUrl(value);
}

function color(value: unknown) {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    return null;
  }

  return value.toLowerCase();
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Body | null;

  const slotId = body?.slotId;

  const name = text(body?.name, 48);

  const url = publicUrl(body?.url);

  const blurb = text(body?.blurb, 120);

  const logoUrl = logo(body?.logoUrl);

  const brand = color(body?.color);

  if (
    typeof slotId !== "number"
    || !Number.isInteger(slotId)
    || slotId < 2
    || slotId > 6
    || !name
    || !url
    || !blurb
    || (body?.logoUrl && logoUrl === null && body.logoUrl !== "")
    || (body?.color && brand === null && body.color !== "")
  ) {
    return NextResponse.json(
      { error: "Check the name, link, and one-liner." },
      { status: 400 },
    );
  }

  const held = await holdSlot({
    id: slotId,
    name,
    url,
    blurb,
    logoUrl,
    color: brand,
  });

  if (!held) {
    return NextResponse.json(
      { error: "That slot is not open." },
      { status: 409 },
    );
  }

  try {
    const origin = new URL(request.url).origin;

    const session = await createCheckout({
      slotId,
      name,
      url,
      blurb,
      logoUrl,
      color: brand,
      cents: sponsorPriceCents(),
      origin,
    });

    await attachCheckout(slotId, session.id);

    return NextResponse.json({
      url: session.url,
      price: formatPrice(sponsorPriceCents()),
    });
  } catch (error) {
    await releaseHold(slotId);

    const message = error instanceof Error
      ? error.message
      : "Checkout did not start.";

    const status = message === "Payments are not configured yet."
      ? 503
      : 502;

    return NextResponse.json(
      { error: message },
      { status },
    );
  }
}
