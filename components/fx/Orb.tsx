"use client";

import dynamic from "next/dynamic";

import type { OrbState } from "thinking-orbs";

const ThinkingOrb = dynamic(
  () =>
    import("thinking-orbs").then(
      (module) => module.ThinkingOrb,
    ),
  { ssr: false },
);

type Props = {
  state: OrbState;

  size?: 64 | 20;

  display?: number;

  paused?: boolean;
};

export function Orb({
  state,
  size = 64,
  display,
  paused,
}: Props) {
  const px = display ?? size;

  return (
    <span
      className="orb-slot"
      style={{
        width: px,
        height: px,
      }}
      aria-hidden
    >
      <ThinkingOrb
        state={state}
        size={size}
        theme="dark"
        paused={paused}
        style={{
          width: px,
          height: px,
          display: "block",
        }}
      />
    </span>
  );
}
