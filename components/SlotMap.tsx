"use client";

import { openSponsor } from "@/lib/site/open";

import { playButtonSound } from "@/lib/sounds";

import type { SlotView } from "@/lib/site/types";

const until = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function Tile({
  slot,
  priceLabel,
}: {
  slot: SlotView;

  priceLabel: string;
}) {
  const label = String(slot.id).padStart(2, "0");

  if (slot.status === "open") {
    return (
      <button
        type="button"
        className="map-tile map-tile-open"
        aria-label={`Slot ${label}, open, ${priceLabel} for 30 days`}
        onClick={() => {
          playButtonSound();
          openSponsor(slot.id);
        }}
      >
        <span className="map-tile-id">
          {label}
          {" "}
          · open
        </span>

        <strong>{priceLabel}</strong>

        <span className="map-tile-cta">Take it →</span>
      </button>
    );
  }

  if (slot.status === "held") {
    return (
      <div className="map-tile map-tile-held">
        <span className="map-tile-id">{label}</span>

        <strong>Reserved</strong>

        <span className="map-tile-cta">awaiting payment</span>
      </div>
    );
  }

  return (
    <a
      className="map-tile map-tile-taken"
      href={slot.url ?? undefined}
      target="_blank"
      rel="sponsored noopener"
    >
      <span className="map-tile-id">{label}</span>

      <span className="map-tile-name">
        {slot.logoUrl ? <img src={slot.logoUrl} alt="" width={22} height={22} /> : null}

        <strong>{slot.name}</strong>
      </span>

      <span className="map-tile-cta">
        {slot.kind === "house"
          ? "featured"
          : slot.paidUntil
            ? `until ${until.format(slot.paidUntil)}`
            : "taken"}
      </span>
    </a>
  );
}

export function SlotMap({
  slots,
  priceLabel,
}: {
  slots: SlotView[];

  priceLabel: string;
}) {
  const left = slots.filter((slot) => slot.id <= 3);

  const right = slots.filter((slot) => slot.id >= 4);

  const open = slots.filter((slot) => slot.status === "open").length;

  return (
    <div className="slot-map">
      <div className="slot-map-stage">
        <div className="slot-map-col">
          {left.map((slot) => (
            <Tile key={slot.id} slot={slot} priceLabel={priceLabel} />
          ))}
        </div>

        <div className="slot-map-center" aria-hidden>
          <span className="slot-map-title">Describe an app</span>

          <span className="slot-map-bar">
            <span>Describe an app</span>

            <span className="slot-map-go">↑</span>
          </span>
        </div>

        <div className="slot-map-col">
          {right.map((slot) => (
            <Tile key={slot.id} slot={slot} priceLabel={priceLabel} />
          ))}
        </div>
      </div>

      <div className="slot-map-foot">
        <p>
          {open > 0
            ? `${open} of ${slots.length} spots open. Tap one, or let us pick.`
            : "Every spot is taken right now."}
        </p>

        {open > 0 ? (
          <button
            type="button"
            className="ui-key sponsor-submit"
            onClick={() => {
              playButtonSound();
              openSponsor(null);
            }}
          >
            Reserve any open spot
          </button>
        ) : null}
      </div>
    </div>
  );
}
