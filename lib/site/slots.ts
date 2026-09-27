import { siteDb } from "@/lib/site/db";

import { releaseExpired } from "@/lib/site/sweep";

import type { SlotRow, SlotView } from "@/lib/site/types";

export const HOLD_MS = 35 * 60 * 1000;

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

async function rows() {
  const sql = await siteDb();

  await releaseExpired(sql);

  return sql.all<SlotRow>(
    `${SLOT_SQL} order by id`,
  );
}

export async function listSlots(): Promise<SlotView[]> {
  const list = await rows();

  if (list.length === 0) {
    return fallbackSlots();
  }

  return list.map(view);
}

export async function readSlot(id: number): Promise<SlotRow | undefined> {
  const sql = await siteDb();

  await releaseExpired(sql);

  return sql.get<SlotRow>(
    `${SLOT_SQL} where id = ?`,
    [id],
  );
}

export type HoldInput = {
  id: number;

  name: string;

  url: string;

  blurb: string;

  logoUrl: string | null;

  color: string | null;
};

export async function holdSlot(input: HoldInput): Promise<boolean> {
  const sql = await siteDb();

  const now = Date.now();

  await releaseExpired(sql, now);

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
      checkout_id = null
    where id = ?
      and kind = 'sale'
      and (
        status = 'open'
        or (
          status = 'held'
          and (hold_until is null or hold_until < ?)
        )
      )
    `,
    [
      input.name,
      input.url,
      input.blurb,
      input.logoUrl,
      input.color,
      now + HOLD_MS,
      input.id,
      now,
    ],
  );

  return changes === 1;
}

export async function attachCheckout(
  id: number,
  checkoutId: string,
) {
  const sql = await siteDb();

  await sql.run(
    `
    update slots
    set checkout_id = ?
    where id = ?
      and kind = 'sale'
      and status = 'held'
    `,
    [checkoutId, id],
  );
}

export async function releaseHold(
  id: number,
  checkoutId?: string,
) {
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
    where id = ?
      and kind = 'sale'
      and status = 'held'
      and (? is null or checkout_id is null or checkout_id = ?)
    `,
    [id, checkoutId ?? null, checkoutId ?? null],
  );
}

export async function markPaid(
  id: number,
  checkoutId: string,
) {
  const sql = await siteDb();

  const now = Date.now();

  await sql.run(
    `
    update slots
    set
      status = 'taken',
      paid_until = ?,
      hold_until = null,
      checkout_id = ?
    where id = ?
      and kind = 'sale'
      and (
        checkout_id = ?
        or (checkout_id is null and status = 'held')
      )
    `,
    [now + TERM_MS, checkoutId, id, checkoutId],
  );
}
