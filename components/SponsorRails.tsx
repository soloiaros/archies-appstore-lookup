"use client";

import { useEffect, useState } from "react";

import { createPortal } from "react-dom";

import { SponsorFlip } from "@/components/SponsorCard";

import type { SlotView } from "@/lib/site/types";

const LEFT = [1, 2, 3];

const RIGHT = [4, 5, 6];

const FLIP_MS = 10_000;

const STAGGER = 90;

function pick(slots: SlotView[], ids: number[]) {
  return ids.flatMap((id) => {
    const slot = slots.find((item) => item.id === id);

    return slot ? [slot] : [];
  });
}

function useTurn() {
  const [turn, setTurn] = useState(0);

  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");

    let id = 0;

    const start = () => {
      window.clearInterval(id);

      if (still.matches) {
        setTurn(0);
        return;
      }

      id = window.setInterval(() => {
        if (document.visibilityState === "visible") {
          setTurn((n) => n + 1);
        }
      }, FLIP_MS);
    };

    start();

    still.addEventListener("change", start);

    return () => {
      window.clearInterval(id);
      still.removeEventListener("change", start);
    };
  }, []);

  return turn;
}

function Strip({
  slots,
  priceLabel,
  turn,
  offset,
}: {
  slots: SlotView[];

  priceLabel: string;

  turn: number;

  offset: number;
}) {
  const set = (copy: boolean) => (
    <div
      className="sponsor-strip-set"
      aria-hidden={copy || undefined}
      inert={copy || undefined}
    >
      {slots.map((slot, at) => (
        <SponsorFlip
          key={`${copy ? "copy" : "main"}-${slot.id}`}
          slot={slot}
          priceLabel={priceLabel}
          size="pill"
          turn={turn}
          delay={(offset + at) * STAGGER}
        />
      ))}
    </div>
  );

  return (
    <div className="sponsor-strip-mask">
      <div className="sponsor-strip-track">
        {set(false)}

        {set(true)}
      </div>
    </div>
  );
}

export function SponsorRails({
  slots,
  priceLabel,
  quiet,
}: {
  slots: SlotView[];

  priceLabel: string;

  quiet?: boolean;
}) {
  const [root, setRoot] = useState<HTMLElement | null>(null);

  const turn = useTurn();

  useEffect(() => {
    setRoot(document.body);
  }, []);

  const left = pick(slots, LEFT);

  const right = pick(slots, RIGHT);

  if (!root || (left.length === 0 && right.length === 0)) {
    return null;
  }

  return createPortal(
    <div
      className="sponsor-rails"
      data-quiet={quiet ? "true" : "false"}
    >
      <aside
        className="sponsor-rail sponsor-rail-left"
        aria-label="Sponsors"
      >
        {left.map((slot, at) => (
          <SponsorFlip
            key={slot.id}
            slot={slot}
            priceLabel={priceLabel}
            size="tile"
            turn={turn}
            delay={at * STAGGER}
          />
        ))}
      </aside>

      <aside
        className="sponsor-rail sponsor-rail-right"
        aria-label="Sponsors"
      >
        {right.map((slot, at) => (
          <SponsorFlip
            key={slot.id}
            slot={slot}
            priceLabel={priceLabel}
            size="tile"
            turn={turn}
            delay={(at + 3) * STAGGER}
          />
        ))}
      </aside>

      <div
        className="sponsor-strip sponsor-strip-top"
        role="complementary"
        aria-label="Sponsors"
      >
        <Strip
          slots={left}
          priceLabel={priceLabel}
          turn={turn}
          offset={0}
        />
      </div>

      <div
        className="sponsor-strip sponsor-strip-bottom"
        role="complementary"
        aria-label="Sponsors"
      >
        <Strip
          slots={right}
          priceLabel={priceLabel}
          turn={turn}
          offset={3}
        />
      </div>
    </div>,
    root,
  );
}
