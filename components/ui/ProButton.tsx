"use client";

import { playButtonSound } from "@/lib/sounds";

export function ProButton({
  variant = "key",
}: {
  variant?: "key" | "text";
}) {
  if (variant === "text") {
    return (
      <button
        type="button"
        className="home-footer-link home-footer-pro"
        onClick={() => playButtonSound()}
      >
        Pro
      </button>
    );
  }

  return (
    <button
      type="button"
      className="ui-key ui-key-pro"
      onClick={() => playButtonSound()}
    >
      <span className="ui-key-label">Pro</span>
    </button>
  );
}
