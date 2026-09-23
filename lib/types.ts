import type { ProvenanceTier } from "@/models/provenance";

import type { Reading } from "@/models/provenance";

export type QueryShape =
  | "factual"
  | "discovery"
  | "comparative";

export type Finalist = {
  trackId: number;

  name: string;

  description: string;

  iconUrl: string;

  tags: string[];
};

export type FactualApp = {
  trackId: number;

  name: string;

  description: string;

  iconUrl: string;

  category: string;

  priceLabel: string;

  storeUrl: string;

  ratingAverage: number | null;

  ratingCount: number | null;

  ratingTier: ProvenanceTier;

  metadataFetchedAt: string;

  momentum: Reading<number>;

  downloads: Reading<string>;
};

export type FactualAnswer = {
  shape: "factual";

  query: string;

  tier: ProvenanceTier;

  app: FactualApp | null;
};

export type ComparativeRow = {
  trackId: number;

  name: string;

  category: string;

  momentum: Reading<number>;
};

export type ComparativeAnswer = {
  shape: "comparative";

  query: string;

  tier: ProvenanceTier;

  rows: ComparativeRow[];
};

export type DiscoveryHit = {
  trackId: number;

  name: string;

  iconUrl: string;

  probability: number;
};

export type DiscoveryAnswer = {
  shape: "discovery";

  query: string;

  tier: ProvenanceTier;

  hits: DiscoveryHit[];
};

export type QueryAnswer =
  | FactualAnswer
  | ComparativeAnswer
  | DiscoveryAnswer;
