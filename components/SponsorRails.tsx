"use client";

import { useEffect, useState } from "react";

import { createPortal } from "react-dom";

import { SponsorCard } from "@/components/SponsorCard";

import type { SlotView } from "@/lib/site/types";

const LEFT = [1, 2, 3];

const RIGHT = [4, 5, 6];

function pick(slots: SlotView[], ids: number[]) {
  return ids.flatMap((id) => {
    const slot = slots.find((item) => item.id === id);

    return slot ? [slot] : [];
  });
}

function Strip({
  slots,
  priceLabel,
}: {
  slots: SlotView[];

  priceLabel: string;
}) {
  return (
    <div className="sponsor-strip-mask">
      <div className="sponsor-strip-track">
        <div className="sponsor-strip-set">
          {slots.map((slot) => (
            <SponsorCard
              key={slot.id}
              slot={slot}
              priceLabel={priceLabel}
            />
          ))}
        </div>

        <div className="sponsor-strip-set" aria-hidden>
          {slots.map((slot) => (
            <SponsorCard
              key={`copy-${slot.id}`}
              slot={slot}
              priceLabel={priceLabel}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SponsorRails({
  slots,
  priceLabel,
}: {
  slots: SlotView[];

  priceLabel: string;
}) {
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setRoot(document.body);
  }, []);

  const left = pick(slots, LEFT);

  const right = pick(slots, RIGHT);

  if (left.length === 0 && right.length === 0) {
    return null;
  }

  const rails = (
    <div className="sponsor-rails">
      <aside
        className="sponsor-rail sponsor-rail-left"
        aria-label="Sponsors"
      >
        {left.map((slot) => (
          <SponsorCard
            key={slot.id}
            slot={slot}
            priceLabel={priceLabel}
          />
        ))}
      </aside>

      <aside
        className="sponsor-rail sponsor-rail-right"
        aria-label="Sponsors"
      >
        {right.map((slot) => (
          <SponsorCard
            key={slot.id}
            slot={slot}
            priceLabel={priceLabel}
          />
        ))}
      </aside>

      <div className="sponsor-strip sponsor-strip-top">
        <Strip slots={left} priceLabel={priceLabel} />
      </div>

      <div className="sponsor-strip sponsor-strip-bottom">
        <Strip slots={right} priceLabel={priceLabel} />
      </div>
    </div>
  );

  if (!root) {
    return null;
  }

  return createPortal(rails, root);
}
