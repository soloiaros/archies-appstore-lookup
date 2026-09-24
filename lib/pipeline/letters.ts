import { RawImage } from "@huggingface/transformers";

import { createWorker } from "tesseract.js";

import type { Worker } from "tesseract.js";

import { squareForOcr } from "@/lib/pipeline/colors";

export const LETTER_METHOD = "tesseract.js eng upscaled";

export async function openLetterReader(): Promise<Worker> {
  const reader = await createWorker(
    "eng",
    1,
    {},
    {
      load_system_dawg: "0",
      load_freq_dawg: "0",
    },
  );

  await reader.setParameters({
    user_defined_dpi: "300",
  });

  return reader;
}

export async function readIconLetters(
  reader: Worker,
  image: RawImage,
): Promise<string> {
  const square = await squareForOcr(image);

  const bytes = await square.toSharp().png().toBuffer();

  const recognized = await reader.recognize(bytes);

  return recognized.data.text
    .replace(/\s+/g, " ")
    .trim();
}
