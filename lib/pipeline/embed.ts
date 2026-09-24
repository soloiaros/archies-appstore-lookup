import { createHash } from "node:crypto";

import type {
  ImageEmbedding,
  TextEmbedding,
} from "@/models/signals";

import {
  AutoProcessor,
  AutoTokenizer,
  RawImage,
  SiglipTextModel,
  SiglipVisionModel,
  load_image,
  pipeline,
} from "@huggingface/transformers";

import type { FeatureExtractionPipeline } from "@huggingface/transformers";

export const BGE_MODEL = "Xenova/bge-small-en-v1.5";

export const SIGLIP_MODEL =
  "onnx-community/siglip2-base-patch16-224-ONNX";

export const BGE_DIMS = 384;

export const SIGLIP_DIMS = 768;

export const BGE_METHOD = BGE_MODEL;

export const SIGLIP_METHOD = SIGLIP_MODEL;

const ASKING =
  "Represent this sentence for searching relevant passages: ";

type SiglipVision = Awaited<
  ReturnType<typeof SiglipVisionModel.from_pretrained>
>;

type SiglipText = Awaited<
  ReturnType<typeof SiglipTextModel.from_pretrained>
>;

type SiglipProcessor = Awaited<
  ReturnType<typeof AutoProcessor.from_pretrained>
>;

type SiglipTokenizer = Awaited<
  ReturnType<typeof AutoTokenizer.from_pretrained>
>;

type EmbedStore = {
  bge?: Promise<FeatureExtractionPipeline>;

  siglipVision?: Promise<{
    processor: SiglipProcessor;

    vision: SiglipVision;
  }>;

  siglipText?: Promise<{
    tokenizer: SiglipTokenizer;

    text: SiglipText;
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

function siglipVision(): Promise<{
  processor: SiglipProcessor;

  vision: SiglipVision;
}> {
  const cache = models();

  return (cache.siglipVision ??= (async () => {
    const processor = await AutoProcessor.from_pretrained(
      SIGLIP_MODEL,
    );

    const vision = await SiglipVisionModel.from_pretrained(
      SIGLIP_MODEL,
      { dtype: "fp16" },
    );

    return {
      processor,
      vision,
    };
  })());
}

function siglipText(): Promise<{
  tokenizer: SiglipTokenizer;

  text: SiglipText;
}> {
  const cache = models();

  return (cache.siglipText ??= (async () => {
    const tokenizer = await AutoTokenizer.from_pretrained(
      SIGLIP_MODEL,
    );

    const text = await SiglipTextModel.from_pretrained(
      SIGLIP_MODEL,
      { dtype: "fp16" },
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

export async function embedIconImage(
  image: RawImage,
): Promise<Float32Array> {
  const { processor, vision } = await siglipVision();

  const inputs = await processor(image);

  const outputs = await vision(inputs);

  const pooled = outputs.pooler_output;

  return l2Normalize(
    Float32Array.from(flatten(pooled.data)),
  );
}

export async function embedIconUrl(
  imageUrl: string,
): Promise<Float32Array> {
  const image = await load_image(imageUrl);

  return embedIconImage(image);
}

export async function embedIconQuery(
  query: string,
): Promise<Float32Array> {
  const { tokenizer, text } = await siglipText();

  const inputs = tokenizer(
    query,
    {
      padding: "max_length",
      truncation: true,
      max_length: 64,
    },
  );

  const outputs = await text(inputs);

  const pooled = outputs.pooler_output;

  return l2Normalize(
    Float32Array.from(flatten(pooled.data)),
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
  model: "siglip2";

  repo: string;

  dimensions: number;

  finite: boolean;

  norm: number;

  vector: number[];
}> {
  const vector = await embedIconUrl(imageUrl);

  const values = Array.from(vector);

  return {
    model: "siglip2",
    repo: SIGLIP_MODEL,
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
