import type { ProvenanceTier } from "@/models/provenance";

export const FIELD_TIERS = {
  "apps.name": "verified",
  "apps.description": "verified",
  "apps.icon_url": "verified",
  "apps.primary_genre": "verified",
  "apps.price": "verified",
  "apps.formatted_price": "verified",
  "rating_snapshots.rating_average": "verified",
  "rating_snapshots.rating_count": "verified",
  "chart_snapshots.rank": "verified",
  "version_releases.version": "verified",
  "sourced_facts.value": "verified",
  "download_estimates.label": "estimated",
  "momentum_scores.score": "estimated",
  "revenue_estimates.low_usd": "estimated",
  "revenue_estimates.mid_usd": "estimated",
  "revenue_estimates.high_usd": "estimated",
} as const;

export type FieldKey = keyof typeof FIELD_TIERS;

export const NO_INFERENCE = [
  "downloads",
  "mau",
] as const;

export function tierFor(
  field: FieldKey,
): ProvenanceTier {
  return FIELD_TIERS[field];
}
