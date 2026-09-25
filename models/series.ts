import type { Citation } from "@/models/provenance";

export type ChartKind =
  | "top-free"
  | "top-paid"
  | "top-grossing";

export type RatingSnapshot = {
  tier: "verified";

  origin: "lookup";

  trackId: number;

  capturedAt: string;

  ratingAverage: number;

  ratingCount: number;
};

export type ChartSnapshot = {
  tier: "verified";

  origin: "rss";

  trackId: number;

  capturedAt: string;

  country: string;

  chart: ChartKind;

  genreId: number | null;

  rank: number;
};

export type VersionRelease = {
  tier: "verified";

  origin: "lookup";

  trackId: number;

  version: string;

  releasedAt: string;

  notes: string;
};

export type SourcedKind =
  | "revenue"
  | "downloads"
  | "funding";

export type SourcedFact = {
  tier: "verified";

  origin: "cited";

  trackId: number;

  kind: SourcedKind;

  value: number;

  unit: string;

  citation: Citation;
};

export type RevenueBasis =
  | "overall-grossing"
  | "genre-grossing"
  | "genre-ceiling"
  | "below-grossing";

export type RevenueBand = {
  low: number | null;

  mid: number | null;

  high: number | null;

  basis: RevenueBasis;

  country: string;

  day: string;
};

export type RevenueEstimateRow = {
  trackId: number;

  capturedOn: string;

  country: string;

  basis: RevenueBasis;

  rank: number | null;

  chart: "top-grossing" | null;

  genreId: number | null;

  lowUsd: number | null;

  midUsd: number | null;

  highUsd: number | null;

  method: string;
};
