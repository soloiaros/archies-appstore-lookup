import type { ProvenanceTier } from "@/models/provenance";

export function ProvenanceMark({
  tier,
  method,
}: {
  tier: ProvenanceTier;

  method?: string;
}) {
  return (
    <span
      className={`tier tier-${tier}`}
    >
      {method
        ? `${tier} · ${method}`
        : tier}
    </span>
  );
}
