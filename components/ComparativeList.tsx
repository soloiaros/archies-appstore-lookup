import { ProvenanceMark } from "@/components/ProvenanceMark";

import type { ComparativeRow } from "@/lib/types";

import type { ProvenanceTier } from "@/models/provenance";

export function ComparativeList({
  rows,
  tier,
}: {
  rows: ComparativeRow[];

  tier: ProvenanceTier;
}) {
  return (
    <section data-shape="comparative">
      <h2>
        Comparison
        {" "}
        <ProvenanceMark tier={tier} />
      </h2>

      {rows.length === 0 ? (
        <p>No ranked apps.</p>
      ) : (
        <ol>
          {rows.map((row) => (
            <li key={row.trackId}>
              <strong>{row.name}</strong>

              <span>
                {" "}
                {row.category}
              </span>

              {" "}

              <ProvenanceMark
                tier={row.momentum.tier}
                method={
                  row.momentum.tier === "estimated"
                    ? row.momentum.method
                    : undefined
                }
              />

              {row.momentum.tier === "estimated" ? (
                <span>
                  {" "}
                  {row.momentum.value}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
