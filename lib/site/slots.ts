import { siteDb } from "@/lib/site/db";

import { releaseExpired } from "@/lib/site/sweep";

import type { SlotRow, SlotView } from "@/lib/site/types";

export const HOLD_MS = 72 * 60 * 60 * 1000;

export const TERM_MS = 30 * 24 * 60 * 60 * 1000;

const SLOT_SQL = `
select
  id,
  kind,
  status,
  name,
  url,
  blurb,
  logo_url as logoUrl,
  color,
  hold_until as holdUntil,
  paid_until as paidUntil,
  checkout_id as checkoutId
from slots
`;

function view(row: SlotRow): SlotView {
  const kind = row.kind === "house" ? "house" : "sale";

  const status = row.status === "held" || row.status === "taken"
    ? row.status
    : "open";

  return {
    id: row.id,
    kind,
    status,
    name: row.name,
    url: row.url,
    blurb: row.blurb,
    logoUrl: row.logoUrl,
    color: row.color,
    paidUntil: row.paidUntil,
  };
}

export function fallbackSlots(): SlotView[] {
  return [
    {
      id: 1,
      kind: "house",
      status: "taken",
      name: "Beau",
      url: "https://www.beaugymjournal.com/",
      blurb: "your frictionless gym journal",
      logoUrl: "/sponsors/beau.png",
      color: "#f4f1ea",
      paidUntil: null,
    },
    ...[2, 3, 4, 5, 6].map((id) => ({
      id,
      kind: "sale" as const,
      status: "open" as const,
      name: null,
      url: null,
      blurb: null,
      logoUrl: null,
      color: null,
      paidUntil: null,
    })),
  ];
}

export async function listSlots(): Promise<SlotView[]> {
  const sql = await siteDb();

  await releaseExpired(sql);

  const list = await sql.all<SlotRow>(
    `${SLOT_SQL} order by id`,
  );

  if (list.length === 0) {
    return fallbackSlots();
  }

  return list.map(view);
}

export type OrderInput = {
  slotId: number | null;

  email: string;

  name: string;

  url: string;

  blurb: string;

  logoUrl: string | null;

  color: string | null;
};

export type OrderResult =
  | { ok: true; orderId: string; slotId: number; holdUntil: number }
  | { ok: false; reason: "taken" | "busy" | "full" };

async function tryHold(
  slotId: number,
  orderId: string,
  input: OrderInput,
  now: number,
) {
  const sql = await siteDb();

  const changes = await sql.run(
    `
    update slots
    set
      status = 'held',
      name = ?,
      url = ?,
      blurb = ?,
      logo_url = ?,
      color = ?,
      hold_until = ?,
      paid_until = null,
      checkout_id = ?
    where id = ?
      and kind = 'sale'
      and status = 'open'
    `,
    [
      input.name,
      input.url,
      input.blurb,
      input.logoUrl,
      input.color,
      now + HOLD_MS,
      orderId,
      slotId,
    ],
  );

  return changes === 1;
}

export async function placeOrder(input: OrderInput): Promise<OrderResult> {
  const sql = await siteDb();

  const now = Date.now();

  await releaseExpired(sql, now);

  const pending = await sql.get<{ id: string }>(
    `
    select orders.id
    from orders
    join slots on slots.checkout_id = orders.id
    where orders.email = ?
      and orders.status = 'pending'
      and slots.status = 'held'
    `,
    [input.email],
  );

  if (pending) {
    return { ok: false, reason: "busy" };
  }

  const orderId = crypto.randomUUID();

  const candidates = input.slotId
    ? [input.slotId]
    : (await sql.all<{ id: number }>(
      "select id from slots where kind = 'sale' and status = 'open' order by id",
    )).map((row) => row.id);

  for (const slotId of candidates) {
    if (!await tryHold(slotId, orderId, input, now)) {
      continue;
    }

    await sql.run(
      `
      insert into orders (id, slot_id, email, created_at, status)
      values (?, ?, ?, ?, 'pending')
      `,
      [orderId, slotId, input.email, now],
    );

    return {
      ok: true,
      orderId,
      slotId,
      holdUntil: now + HOLD_MS,
    };
  }

  return {
    ok: false,
    reason: input.slotId ? "taken" : "full",
  };
}

export async function cancelOrder(orderId: string) {
  const sql = await siteDb();

  await sql.run(
    `
    update slots
    set
      status = 'open',
      name = null,
      url = null,
      blurb = null,
      logo_url = null,
      color = null,
      hold_until = null,
      paid_until = null,
      checkout_id = null
    where checkout_id = ?
      and kind = 'sale'
      and status = 'held'
    `,
    [orderId],
  );

  await sql.run(
    "update orders set status = 'released' where id = ? and status = 'pending'",
    [orderId],
  );
}

export type OrderView = {
  id: string;

  slotId: number;

  email: string;

  status: string;

  slotStatus: string | null;

  name: string | null;

  url: string | null;
};

export async function readOrder(orderId: string): Promise<OrderView | undefined> {
  const sql = await siteDb();

  await releaseExpired(sql);

  return sql.get<OrderView>(
    `
    select
      orders.id,
      orders.slot_id as slotId,
      orders.email,
      orders.status,
      slots.status as slotStatus,
      slots.name,
      slots.url
    from orders
    left join slots
      on slots.id = orders.slot_id
      and slots.checkout_id = orders.id
    where orders.id = ?
    `,
    [orderId],
  );
}

export async function confirmOrder(orderId: string): Promise<boolean> {
  const sql = await siteDb();

  const now = Date.now();

  await releaseExpired(sql, now);

  const changes = await sql.run(
    `
    update slots
    set
      status = 'taken',
      paid_until = ?,
      hold_until = null
    where checkout_id = ?
      and kind = 'sale'
      and status = 'held'
    `,
    [now + TERM_MS, orderId],
  );

  if (changes !== 1) {
    return false;
  }

  await sql.run(
    "update orders set status = 'paid' where id = ?",
    [orderId],
  );

  return true;
}
