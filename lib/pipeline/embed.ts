import { createHash } from "node:crypto";

import type {
  ImageEmbedding,
  TextEmbedding,
} from "@/models/signals";

import {
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  load_image,
  pipeline,
} from "@huggingface/transformers";

import type { FeatureExtractionPipeline } from "@huggingface/transformers";

export const BGE_MODEL = "Xenova/bge-small-en-v1.5";

export const CLIP_MODEL = "Xenova/clip-vit-base-patch32";

export const BGE_DIMS = 384;

export const CLIP_DIMS = 512;

export const BGE_METHOD = BGE_MODEL;

export const CLIP_METHOD = CLIP_MODEL;

const ASKING =
  "Represent this sentence for searching relevant passages: ";

type ClipVision = Awaited<
  ReturnType<
    typeof CLIPVisionModelWithProjection.from_pretrained
  >
>;

type ClipText = Awaited<
  ReturnType<
    typeof CLIPTextModelWithProjection.from_pretrained
  >
>;

type ClipProcessor = Awaited<
  ReturnType<typeof AutoProcessor.from_pretrained>
>;

type ClipTokenizer = Awaited<
  ReturnType<typeof AutoTokenizer.from_pretrained>
>;

type EmbedStore = {
  bge?: Promise<FeatureExtractionPipeline>;

  clipVision?: Promise<{
    processor: ClipProcessor;

    vision: ClipVision;
  }>;

  clipText?: Promise<{
    tokenizer: ClipTokenizer;

    text: ClipText;
  }>;
};

const store = globalThis as typeof globalThis & {
  __embedModels?: EmbedStore;
};

function models(): EmbedStore {
  return (store.__embedModels ??= {});
}

function bge(): Promise<FeatureExtractionPipeline> {
  const cache = models();

  return (cache.bge ??= pipeline(
    "feature-extraction",
    BGE_MODEL,
    { dtype: "q8" },
  ));
}

function clipVision(): Promise<{
  processor: ClipProcessor;

  vision: ClipVision;
}> {
  const cache = models();

  return (cache.clipVision ??= (async () => {
    const processor = await AutoProcessor.from_pretrained(
      CLIP_MODEL,
    );

    const vision =
      await CLIPVisionModelWithProjection.from_pretrained(
        CLIP_MODEL,
        { dtype: "q8" },
      );

    return {
      processor,
      vision,
    };
  })());
}

function clipText(): Promise<{
  tokenizer: ClipTokenizer;

  text: ClipText;
}> {
  const cache = models();

  return (cache.clipText ??= (async () => {
    const tokenizer = await AutoTokenizer.from_pretrained(
      CLIP_MODEL,
    );

    const text =
      await CLIPTextModelWithProjection.from_pretrained(
        CLIP_MODEL,
        { dtype: "q8" },
      );

    return {
      tokenizer,
      text,
    };
  })());
}

export function hashSource(
  value: string,
): string {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

export function encodeVector(
  vector: Float32Array,
): Uint8Array {
  return new Uint8Array(
    vector.buffer,
    vector.byteOffset,
    vector.byteLength,
  );
}

export function decodeVector(
  blob: Buffer | Uint8Array,
): Float32Array {
  const copy = Buffer.from(blob);

  return new Float32Array(
    copy.buffer,
    copy.byteOffset,
    copy.byteLength / 4,
  );
}

export function cosine(
  left: Float32Array | number[],
  right: Float32Array | number[],
): number {
  const length = Math.min(
    left.length,
    right.length,
  );

  let sum = 0;

  for (let index = 0; index < length; index += 1) {
    sum += left[index]! * right[index]!;
  }

  return sum;
}

export function l2Normalize(
  vector: Float32Array,
): Float32Array {
  let sum = 0;

  for (const value of vector) {
    sum += value * value;
  }

  const norm = Math.sqrt(sum);

  if (norm === 0) {
    return vector;
  }

  const out = new Float32Array(vector.length);

  for (let index = 0; index < vector.length; index += 1) {
    out[index] = vector[index]! / norm;
  }

  return out;
}

export async function embedDescriptions(
  texts: string[],
): Promise<Float32Array[]> {
  if (texts.length === 0) {
    return [];
  }

  const extractor = await bge();

  const tensor = await extractor(
    texts.map((text) => text || "nothing"),
    {
      pooling: "cls",
      normalize: true,
    },
  );

  const data = flatten(tensor.data);

  const out: Float32Array[] = [];

  for (let index = 0; index < texts.length; index += 1) {
    const start = index * BGE_DIMS;

    out.push(
      Float32Array.from(
        data.slice(start, start + BGE_DIMS),
      ),
    );
  }

  return out;
}

export async function embedAsking(
  query: string,
): Promise<Float32Array> {
  const [vector] = await embedDescriptions([
    ASKING + query,
  ]);

  return vector ?? new Float32Array(BGE_DIMS);
}

export async function embedIconUrl(
  imageUrl: string,
): Promise<Float32Array> {
  const { processor, vision } = await clipVision();

  const image = await load_image(imageUrl);

  const inputs = await processor(image);

  const outputs = await vision(inputs);

  return l2Normalize(
    Float32Array.from(
      flatten(outputs.image_embeds.data),
    ),
  );
}

export async function embedIconQuery(
  query: string,
): Promise<Float32Array> {
  const { tokenizer, text } = await clipText();

  const inputs = tokenizer(
    query,
    {
      padding: true,
      truncation: true,
    },
  );

  const outputs = await text(inputs);

  return l2Normalize(
    Float32Array.from(
      flatten(outputs.text_embeds.data),
    ),
  );
}

export async function embedText(
  trackIds: number[],
): Promise<TextEmbedding[]> {
  void trackIds;

  throw new Error(
    "use embed-pass script",
  );
}

export async function embedImages(
  trackIds: number[],
): Promise<ImageEmbedding[]> {
  void trackIds;

  throw new Error(
    "use embed-pass script",
  );
}

export async function probeTextEmbedding(
  text: string,
): Promise<{
  model: "bge-small";

  repo: string;

  dimensions: number;

  finite: boolean;

  norm: number;

  vector: number[];
}> {
  const [vector] = await embedDescriptions([text]);

  const values = Array.from(
    vector ?? new Float32Array(),
  );

  return {
    model: "bge-small",
    repo: BGE_MODEL,
    dimensions: values.length,
    finite: values.every(Number.isFinite),
    norm: l2(values),
    vector: values,
  };
}

export async function probeIconEmbedding(
  imageUrl: string,
): Promise<{
  model: "clip";

  repo: string;

  dimensions: number;

  finite: boolean;

  norm: number;

  vector: number[];
}> {
  const vector = await embedIconUrl(imageUrl);

  const values = Array.from(vector);

  return {
    model: "clip",
    repo: CLIP_MODEL,
    dimensions: values.length,
    finite: values.every(Number.isFinite),
    norm: l2(values),
    vector: values,
  };
}

function flatten(
  data: { readonly length: number },
): number[] {
  const vector: number[] = [];

  for (let index = 0; index < data.length; index += 1) {
    vector.push(
      Number(
        (data as { [index: number]: unknown })[index],
      ),
    );
  }

  return vector;
}

function l2(
  vector: number[],
): number {
  let sum = 0;

  for (const value of vector) {
    sum += value * value;
  }

  return Math.sqrt(sum);
}
