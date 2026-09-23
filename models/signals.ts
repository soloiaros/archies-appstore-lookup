import type {
  Estimated,
  Reading,
} from "@/models/provenance";

export type DownloadEstimate = Estimated<string>;

export type MomentumScore = Estimated<number>;

export type MomentumReading = Reading<number>;

export type TextEmbedding = {
  trackId: number;

  model: "bge-small";

  sourceHash: string;

  vector: number[];
};

export type ImageTarget =
  | "icon"
  | "screenshot";

export type ImageEmbedding = {
  trackId: number;

  model: "clip";

  sourceHash: string;

  target: ImageTarget;

  vector: number[];
};

export type ScreenshotOcr = {
  trackId: number;

  screenshotUrl: string;

  text: string;
};

export type Tag = {
  id: string;

  label: string;
};

export type AppTag = {
  trackId: number;

  tagId: string;
};
