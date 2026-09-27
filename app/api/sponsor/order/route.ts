import { formatPrice, sponsorPriceCents } from "@/lib/site/price";

import {
  ownerEmail,
  sendMail,
  wiseDetails,
} from "@/lib/site/mail";

import { cancelOrder, placeOrder } from "@/lib/site/slots";

export const dynamic = "force-dynamic";

type Body = {
  slotId?: unknown;

  email?: unknown;

  name?: unknown;

  url?: unknown;

  blurb?: unknown;

  logoUrl?: unknown;

  color?: unknown;
};

const LOGO_DATA = /^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/;

const until = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

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

function httpsUrl(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const url = new URL(value.trim());

    if (url.protocol !== "https:" || url.username || url.password) {
      return null;
    }

    return url.href.slice(0, 300);
  } catch {
    return null;
  }
}

function logo(value: unknown): string | null | false {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return false;
  }

  if (value.startsWith("data:")) {
    return value.length <= 90_000 && LOGO_DATA.test(value)
      ? value
      : false;
  }

  return httpsUrl(value) ?? false;
}

function color(value: unknown): string | null | false {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    return false;
  }

  return value.toLowerCase();
}

function email(value: unknown) {
  const address = text(value, 120)?.toLowerCase() ?? null;

  if (!address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return null;
  }

  return address;
}

function slotLabel(id: number) {
  return String(id).padStart(2, "0");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Body | null;

  const slotId = body?.slotId == null
    ? null
    : typeof body.slotId === "number"
      && Number.isInteger(body.slotId)
      && body.slotId >= 2
      && body.slotId <= 6
      ? body.slotId
      : undefined;

  const input = {
    email: email(body?.email),
    name: text(body?.name, 40),
    url: httpsUrl(body?.url),
    blurb: text(body?.blurb, 90),
    logoUrl: logo(body?.logoUrl),
    color: color(body?.color),
  };

  if (
    slotId === undefined
    || !input.email
    || !input.name
    || !input.url
    || !input.blurb
    || input.logoUrl === false
    || input.color === false
  ) {
    return Response.json(
      { error: "Check the link, name, email, and description." },
      { status: 400 },
    );
  }

  const result = await placeOrder({
    slotId,
    email: input.email,
    name: input.name,
    url: input.url,
    blurb: input.blurb,
    logoUrl: input.logoUrl,
    color: input.color,
  });

  if (!result.ok) {
    const error = result.reason === "busy"
      ? "This email already has a slot waiting for payment."
      : result.reason === "taken"
        ? "That slot was just taken. Pick another."
        : "Every slot is taken right now.";

    return Response.json({ error }, { status: 409 });
  }

  const price = formatPrice(sponsorPriceCents());

  const label = slotLabel(result.slotId);

  const reference = `10K-${label}-${result.orderId.slice(0, 8).toUpperCase()}`;

  const deadline = until.format(result.holdUntil);

  const origin = new URL(request.url).origin;

  try {
    await sendMail({
      to: input.email,
      subject: `Your 10K slot ${label}: payment details`,
      text: [
        `Thanks, ${input.name} is holding slot ${label} on 10K.`,
        "",
        `Amount: ${price} (30 days, paid once, no renewal)`,
        `Reference: ${reference}`,
        `Hold ends: ${deadline}`,
        "",
        "Pay by Wise to:",
        wiseDetails(),
        "",
        "Put the reference in the transfer note. Your card goes live once the payment arrives,",
        "and runs for 30 days from then. If the hold ends unpaid, the slot opens again.",
      ].join("\n"),
    });

    const owner = ownerEmail();

    if (owner) {
      await sendMail({
        to: owner,
        subject: `New 10K sponsor order: slot ${label}`,
        text: [
          `${input.name} (${input.email}) wants slot ${label}.`,
          `Link: ${input.url}`,
          `Line: ${input.blurb}`,
          `Reference: ${reference}`,
          `Hold ends: ${deadline}`,
          "",
          "When the Wise payment arrives, confirm it here:",
          `${origin}/api/sponsor/confirm?order=${result.orderId}`,
        ].join("\n"),
      });
    }
  } catch {
    await cancelOrder(result.orderId);

    return Response.json(
      { error: "We could not send the payment email. Nothing was reserved." },
      { status: 503 },
    );
  }

  return Response.json({
    slotId: result.slotId,
    reference,
    holdUntil: result.holdUntil,
  });
}
