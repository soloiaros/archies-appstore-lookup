import type { AppMetadata } from "@/models/app";

import type { Reading } from "@/models/provenance";

import type {
  ChartSnapshot,
  RatingSnapshot,
} from "@/models/series";

import type { Finalist } from "@/lib/types";

export type RankedApp = {
  app: AppMetadata;

  momentum: Reading<number>;
};

export type Catalog = {
  findByName(
    name: string,
  ): Promise<AppMetadata | null>;

  ratings(
    trackId: number,
  ): Promise<RatingSnapshot[]>;

  charts(
    trackId: number,
  ): Promise<ChartSnapshot[]>;

  finalists(
    query: string,
  ): Promise<Finalist[]>;

  ranked(): Promise<RankedApp[]>;
};
