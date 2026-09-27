import { createHmac, timingSafeEqual } from "node:crypto";

export type CheckoutDraft = {
  slotId: number;

  name: string;

  url: string;

  blurb: string;

  logoUrl: string | null;

  color: string | null;

  cents: number;

  origin: string;
};

type StripeSession = {
  id?: string;

  url?: string | null;

  mode?: string;

  payment_status?: string;

  amount_total?: number | null;

  metadata?: { slot?: string };
};

function stripeKey() {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    return null;
  }

  return key;
}

async function stripeForm(
  path: string,
  body?: URLSearchParams,
) {
  const key = stripeKey();

  if (!key) {
    throw new Error("Payments are not configured yet.");
  }

  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      authorization: `Bearer ${key}`,
      ...(body
        ? { "content-type": "application/x-www-form-urlencoded" }
        : {}),
    },
    body,
  });

  const payload = await response.json() as StripeSession & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(
      payload.error?.message ?? "Stripe did not start checkout.",
    );
  }

  return payload;
}

export function paymentsConfigured() {
  return Boolean(stripeKey());
}

export async function createCheckout(draft: CheckoutDraft) {
  const expires = Math.floor(Date.now() / 1000) + 30 * 60;

  const success = `${draft.origin}/sponsor?paid=1&slot=${draft.slotId}`;

  const cancel = `${draft.origin}/api/sponsor/cancel?slot=${draft.slotId}&session_id={CHECKOUT_SESSION_ID}`;

  const body = new URLSearchParams();

  body.set("mode", "payment");

  body.set("success_url", success);

  body.set("cancel_url", cancel);

  body.set("expires_at", String(expires));

  body.set("client_reference_id", String(draft.slotId));

  body.set("metadata[slot]", String(draft.slotId));

  body.set("line_items[0][quantity]", "1");

  body.set("line_items[0][price_data][currency]", "usd");

  body.set(
    "line_items[0][price_data][unit_amount]",
    String(draft.cents),
  );

  body.set(
    "line_items[0][price_data][product_data][name]",
    `10K sponsor slot ${String(draft.slotId).padStart(2, "0")}`,
  );

  body.set(
    "line_items[0][price_data][product_data][description]",
    "30 days of placement on Search. Paid once. Does not renew.",
  );

  const session = await stripeForm("checkout/sessions", body);

  if (!session.id || !session.url) {
    throw new Error("Stripe did not start checkout.");
  }

  return {
    id: session.id,
    url: session.url,
  };
}

export async function readCheckout(id: string) {
  return stripeForm(`checkout/sessions/${encodeURIComponent(id)}`);
}

export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
) {
  if (!header) {
    return false;
  }

  const parts = header.split(",");

  const timestamp = parts
    .find((part) => part.startsWith("t="))
    ?.slice(2);

  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));

  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));

  if (!Number.isFinite(age) || age > 300) {
    return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  const expectedBytes = Buffer.from(expected);

  return signatures.some((signature) => {
    const given = Buffer.from(signature);

    return given.length === expectedBytes.length
      && timingSafeEqual(given, expectedBytes);
  });
}
