"use client";

import Link from "next/link";

import { inkOn, muteOn } from "@/lib/site/color";

import { playButtonSound } from "@/lib/sounds";

import type { SlotView } from "@/lib/site/types";

export function SponsorCard({
  slot,
  priceLabel,
}: {
  slot: SlotView;

  priceLabel: string;
}) {
  const live = slot.status !== "open"
    && slot.status !== "held"
    && slot.name
    && slot.url;

  if (live && slot.url && slot.name) {
    const background = slot.color ?? "#1a1a1c";

    return (
      <a
        className="sponsor-card sponsor-card-live"
        href={slot.url}
        target="_blank"
        rel="sponsored noopener"
        title={`${slot.name} (sponsored)`}
        style={{
          background,
          color: inkOn(background),
        }}
        onClick={() => playButtonSound()}
      >
        {slot.logoUrl ? (
          <img
            src={slot.logoUrl}
            alt=""
            width={36}
            height={36}
          />
        ) : null}

        <strong>{slot.name}</strong>

        {slot.blurb ? (
          <span style={{ color: muteOn(background) }}>
            {slot.blurb}
          </span>
        ) : null}
      </a>
    );
  }

  if (slot.status === "held") {
    return (
      <div className="sponsor-card sponsor-card-open">
        <span className="sponsor-kicker">Held</span>

        <strong>In checkout</strong>

        <span>This spot is reserved for a few minutes.</span>
      </div>
    );
  }

  return (
    <Link
      className="sponsor-card sponsor-card-open"
      href={`/sponsor?slot=${slot.id}#take`}
      onClick={() => playButtonSound()}
    >
      <span className="sponsor-kicker">Open slot</span>

      <strong>
        {priceLabel}
        <span> / 30 days</span>
      </strong>

      <span>put your product here →</span>
    </Link>
  );
}
