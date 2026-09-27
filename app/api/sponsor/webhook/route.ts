import { sponsorPriceCents } from "@/lib/site/price";

import { markPaid, releaseHold } from "@/lib/site/slots";

import { verifyStripeSignature } from "@/lib/site/stripe";

export const dynamic = "force-dynamic";

type StripeEvent = {
  type?: string;

  data?: {
    object?: {
      id?: string;

      mode?: string;

      payment_status?: string;

      amount_total?: number | null;

      metadata?: { slot?: string };
    };
  };
};

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    return Response.json(
      { error: "Webhook secret is missing." },
      { status: 503 },
    );
  }

  const payload = await request.text();

  const ok = verifyStripeSignature(
    payload,
    request.headers.get("stripe-signature"),
    secret,
  );

  if (!ok) {
    return Response.json(
      { error: "Bad signature." },
      { status: 400 },
    );
  }

  let event: StripeEvent;

  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return Response.json(
      { error: "Bad payload." },
      { status: 400 },
    );
  }

  const session = event.data?.object;

  const slotId = Number(session?.metadata?.slot);

  const checkoutId = session?.id ?? "";

  if (!Number.isInteger(slotId) || slotId < 2 || slotId > 6 || !checkoutId) {
    return Response.json({ ok: true });
  }

  if (event.type === "checkout.session.expired") {
    await releaseHold(slotId, checkoutId);

    return Response.json({ ok: true });
  }

  if (event.type !== "checkout.session.completed") {
    return Response.json({ ok: true });
  }

  if (session?.mode !== "payment" || session.payment_status !== "paid") {
    return Response.json({ ok: true });
  }

  if (session.amount_total !== sponsorPriceCents()) {
    return Response.json(
      { error: "Amount does not match the slot price." },
      { status: 400 },
    );
  }

  await markPaid(slotId, checkoutId);

  return Response.json({ ok: true });
}
