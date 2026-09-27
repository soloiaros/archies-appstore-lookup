import { timingSafeEqual } from "node:crypto";

import { confirmOrder, readOrder } from "@/lib/site/slots";

export const dynamic = "force-dynamic";

function page(title: string, body: string, status = 200) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0b0c;color:#f2f2f3;font:15px/1.5 system-ui,sans-serif}
main{width:min(420px,calc(100vw - 40px));padding:28px;border-radius:20px;background:#0c0c0e;box-shadow:inset 0 1px 0 rgb(255 255 255/.04),inset 0 -1px 3px rgb(0 0 0/.35)}
h1{margin:0 0 8px;font-size:20px;letter-spacing:-.02em}
p{margin:0 0 16px;color:#8a8a90}
input{box-sizing:border-box;width:100%;margin:0 0 12px;padding:12px 14px;border:0;border-radius:12px;background:#121214;color:#f2f2f3;font:inherit;box-shadow:inset 0 2px 5px rgb(0 0 0/.35)}
button{padding:10px 18px;border:0;border-radius:999px;background:#1a1a1c;color:#f2f2f3;font:inherit;font-weight:500;cursor:pointer;box-shadow:inset 0 1px 0 rgb(255 255 255/.07),inset 0 -1px 0 rgb(0 0 0/.28),0 1px 2px rgb(0 0 0/.18)}
</style>
</head>
<body><main>${body}</main></body>
</html>`;

  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function escape(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[char] ?? char);
}

function keyMatches(given: string) {
  const expected = process.env.SPONSOR_ADMIN_KEY;

  if (!expected || !given) {
    return false;
  }

  const a = Buffer.from(given);

  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("order") ?? "";

  const order = /^[0-9a-f-]{36}$/.test(orderId)
    ? await readOrder(orderId)
    : undefined;

  if (!order) {
    return page("Order not found", "<h1>Order not found</h1>", 404);
  }

  const label = String(order.slotId).padStart(2, "0");

  if (order.status === "paid") {
    return page("Already live", `<h1>Slot ${label} is live</h1><p>This order was already confirmed.</p>`);
  }

  if (order.slotStatus !== "held") {
    return page(
      "Hold ended",
      `<h1>The hold on slot ${label} ended</h1><p>The slot opened again before payment was confirmed.</p>`,
      410,
    );
  }

  return page(
    "Confirm payment",
    `<h1>Confirm slot ${label}</h1>
<p>${escape(order.name ?? "")} · ${escape(order.email)}</p>
<form method="post">
<input type="hidden" name="order" value="${escape(order.id)}">
<input type="password" name="key" placeholder="Admin key" autocomplete="current-password" required>
<button type="submit">Payment arrived, go live</button>
</form>`,
  );
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);

  const orderId = String(form?.get("order") ?? "");

  const key = String(form?.get("key") ?? "");

  if (!keyMatches(key)) {
    return page("Wrong key", "<h1>Wrong key</h1><p>Nothing changed.</p>", 403);
  }

  const done = await confirmOrder(orderId);

  if (!done) {
    return page(
      "Not confirmed",
      "<h1>Not confirmed</h1><p>The hold ended or the order was already handled.</p>",
      409,
    );
  }

  return page("Live", "<h1>The card is live</h1><p>It runs for 30 days from now.</p>");
}
