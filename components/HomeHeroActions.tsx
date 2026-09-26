"use client";

import Link from "next/link";

import { ProButton } from "@/components/ui/ProButton";

import { playButtonSound } from "@/lib/sounds";

export function HomeHeroActions() {
  return (
    <div className="home-hero-actions">
      <Link
        href="/search"
        className="ui-key"
        transitionTypes={["section"]}
        onClick={() => playButtonSound()}
      >
        <span className="ui-key-label">Use for free</span>
      </Link>

      <ProButton />
    </div>
  );
}
