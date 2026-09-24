import type { CSSProperties } from "react";

import { ProvenanceMark } from "@/components/ProvenanceMark";

import type { DiscoveryHit } from "@/lib/types";

import type { ProvenanceTier } from "@/models/provenance";

export function DiscoveryList({
  hits,
  tier,
  scoring,
  scoringNote,
  finalistCount,
}: {
  hits: DiscoveryHit[];

  tier: ProvenanceTier;

  scoring: "scored" | "unavailable";

  scoringNote: string | null;

  finalistCount: number;
}) {
  if (scoring === "unavailable") {
    return (
      <p className="notice" data-shape="discovery">
        {scoringNote
          ?? "Scoring needs an OpenRouter key."}
        {" "}
        Retrieved
        {" "}
        {finalistCount}
        {" "}
        finalists without scores.
        {" "}
        <ProvenanceMark tier={tier} />
      </p>
    );
  }

  if (hits.length === 0) {
    return (
      <p className="notice" data-shape="discovery">
        No apps cleared the certainty threshold.
        {" "}
        <ProvenanceMark tier={tier} />
      </p>
    );
  }

  return (
    <div data-shape="discovery">
      <p className="indexed">
        <ProvenanceMark tier={tier} />
      </p>

      <div className="matches">
        {hits.map((hit, index) => (
          <figure
            key={hit.trackId}
            className="match"
            style={{ "--i": index } as CSSProperties}
          >
            <figcaption className="match-label">
              {Math.round(hit.probability * 100)}
              %
            </figcaption>

            <img
              src={hit.iconUrl}
              alt=""
            />

            <figcaption className="match-name">
              {hit.name}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
