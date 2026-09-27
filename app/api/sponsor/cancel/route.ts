import { NextResponse } from "next/server";

import { readSlot, releaseHold } from "@/lib/site/slots";

import { readCheckout } from "@/lib/site/stripe";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const slotId = Number(url.searchParams.get("slot"));

  const sessionId = url.searchParams.get("session_id") ?? "";

  const back = new URL("/sponsor", url.origin);

  if (Number.isInteger(slotId)) {
    back.searchParams.set("slot", String(slotId));
  }

  if (!Number.isInteger(slotId) || slotId < 2 || slotId > 6 || !sessionId.startsWith("cs_")) {
    return NextResponse.redirect(back);
  }

  try {
    const session = await readCheckout(sessionId);

    const sameSlot = session.metadata?.slot === String(slotId);

    if (sameSlot && session.payment_status !== "paid") {
      await releaseHold(slotId, sessionId);
    }
  } catch {
    const slot = await readSlot(slotId);

    if (slot?.status === "held" && slot.checkoutId === sessionId) {
      await releaseHold(slotId, sessionId);
    }
  }

  back.searchParams.set("canceled", "1");

  return NextResponse.redirect(back);
}
