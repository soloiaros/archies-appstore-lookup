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
  return (
    <section data-shape="discovery">
      <h2>
        Matches
        {" "}
        <ProvenanceMark tier={tier} />
      </h2>

      {scoring === "unavailable" ? (
        <p>
          {scoringNote
            ?? "Scoring needs TYPE_SAFE_KEY."}
          {" "}
          Retrieved
          {" "}
          {finalistCount}
          {" "}
          finalists without scores.
        </p>
      ) : null}

      {scoring === "scored"
      && hits.length === 0 ? (
        <p>No apps cleared the certainty threshold.</p>
      ) : null}

      {hits.length > 0 ? (
        <ol>
          {hits.map((hit) => (
            <li key={hit.trackId}>
              <strong>{hit.name}</strong>

              <span>
                {" "}
                {Math.round(hit.probability * 100)}
                %
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
