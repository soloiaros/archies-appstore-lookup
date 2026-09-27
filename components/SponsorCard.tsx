"use client";

import type { CSSProperties, ReactNode } from "react";

import { inkOn, muteOn } from "@/lib/site/color";

import { openSponsor } from "@/lib/site/open";

import { playButtonSound } from "@/lib/sounds";

import type { SlotView } from "@/lib/site/types";

type Size = "tile" | "pill";

export type FaceData = {
  name: string;

  blurb: string | null;

  logoUrl: string | null;

  color: string | null;
};

export function LiveFace({
  data,
  size,
  href,
  inert,
}: {
  data: FaceData;

  size: Size;

  href?: string;

  inert?: boolean;
}) {
  const background = data.color ?? "#1a1a1c";

  const style: CSSProperties = {
    background,
    color: inkOn(background),
  };

  const body: ReactNode = (
    <>
      {data.logoUrl ? (
        <img
          src={data.logoUrl}
          alt=""
          width={size === "tile" ? 36 : 24}
          height={size === "tile" ? 36 : 24}
        />
      ) : (
        <span className="sponsor-mark" aria-hidden>
          {data.name.slice(0, 1).toUpperCase() || "?"}
        </span>
      )}

      <span className="sponsor-copy">
        <strong>{data.name}</strong>

        {data.blurb ? (
          <span style={{ color: muteOn(background) }}>
            {data.blurb}
          </span>
        ) : null}
      </span>
    </>
  );

  if (!href) {
    return (
      <div
        className={`sponsor-face sponsor-live sponsor-${size}`}
        style={style}
      >
        {body}
      </div>
    );
  }

  return (
    <a
      className={`sponsor-face sponsor-live sponsor-${size}`}
      href={href}
      target="_blank"
      rel="sponsored noopener"
      title={`${data.name} (sponsored)`}
      tabIndex={inert ? -1 : undefined}
      style={style}
      onClick={() => playButtonSound()}
    >
      {body}
    </a>
  );
}

function OpenFace({
  slotId,
  size,
  priceLabel,
  inert,
}: {
  slotId: number | null;

  size: Size;

  priceLabel: string;

  inert?: boolean;
}) {
  return (
    <button
      type="button"
      className={`sponsor-face sponsor-open sponsor-${size}`}
      tabIndex={inert ? -1 : undefined}
      aria-label={`Open ad slot, ${priceLabel} for 30 days`}
      onClick={() => {
        playButtonSound();
        openSponsor(slotId);
      }}
    >
      <span className="sponsor-kicker">Open slot</span>

      <strong>
        {priceLabel}
        <span>/30 days</span>
      </strong>

      <span className="sponsor-cta">put your product here →</span>
    </button>
  );
}

function HeldFace({ size }: { size: Size }) {
  return (
    <div className={`sponsor-face sponsor-open sponsor-held sponsor-${size}`}>
      <span className="sponsor-kicker">Reserved</span>

      <strong>Awaiting payment</strong>

      <span className="sponsor-cta">opens again if unpaid</span>
    </div>
  );
}

function Front({
  slot,
  size,
  priceLabel,
  inert,
}: {
  slot: SlotView;

  size: Size;

  priceLabel: string;

  inert: boolean;
}) {
  if (slot.status === "taken" && slot.name && slot.url) {
    return (
      <LiveFace
        data={{
          name: slot.name,
          blurb: slot.blurb,
          logoUrl: slot.logoUrl,
          color: slot.color,
        }}
        size={size}
        href={slot.url}
        inert={inert}
      />
    );
  }

  if (slot.status === "held") {
    return <HeldFace size={size} />;
  }

  return (
    <OpenFace
      slotId={slot.id}
      size={size}
      priceLabel={priceLabel}
      inert={inert}
    />
  );
}

export function SponsorFlip({
  slot,
  priceLabel,
  size,
  turn,
  delay,
}: {
  slot: SlotView;

  priceLabel: string;

  size: Size;

  turn: number;

  delay: number;
}) {
  const backUp = turn % 2 === 1;

  return (
    <div className={`sponsor-flip sponsor-flip-${size}`}>
      <div
        className="sponsor-flip-card"
        style={{
          transform: `rotateY(${turn * 180}deg)`,
          transitionDelay: `${delay}ms`,
        }}
      >
        <div
          className="sponsor-flip-face"
          aria-hidden={backUp}
          inert={backUp}
        >
          <Front
            slot={slot}
            size={size}
            priceLabel={priceLabel}
            inert={backUp}
          />
        </div>

        <div
          className="sponsor-flip-face sponsor-flip-back"
          aria-hidden={!backUp}
          inert={!backUp}
        >
          <Front
            slot={slot}
            size={size}
            priceLabel={priceLabel}
            inert={!backUp}
          />
        </div>
      </div>
    </div>
  );
}
