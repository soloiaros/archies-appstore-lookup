import { ProvenanceMark } from "@/components/ProvenanceMark";

import type { DiscoveryHit } from "@/lib/types";

import type { ProvenanceTier } from "@/models/provenance";

// TODO(phase-7)

export function DiscoveryList({
  hits,
  tier,
}: {
  hits: DiscoveryHit[];

  tier: ProvenanceTier;
}) {
  return (
    <section data-shape="discovery">
      <h2>
        Matches
        {" "}
        <ProvenanceMark tier={tier} />
      </h2>

      {hits.length === 0 ? (
        <p>No finalists.</p>
      ) : (
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
      )}
    </section>
  );
}
