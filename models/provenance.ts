export type ProvenanceTier =
  | "verified"
  | "estimated"
  | "unavailable";

export type Citation = {
  title: string;

  url: string;

  notedAt: string;
};

export type Verified<T> = {
  tier: "verified";

  value: T;
};

export type Cited<T> = {
  tier: "verified";

  value: T;

  citation: Citation;
};

export type Estimated<T> = {
  tier: "estimated";

  value: T;

  method: string;
};

export type Unavailable = {
  tier: "unavailable";

  value: null;
};

export type Reading<T> =
  | Verified<T>
  | Estimated<T>
  | Unavailable;

export type SourcedReading<T> =
  | Cited<T>
  | Unavailable;
