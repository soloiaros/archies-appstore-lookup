import type { ScreenshotOcr } from "@/models/signals";

import { createWorker } from "tesseract.js";

const OCR_METHOD = "tesseract.js eng";

export async function readScreenshots(
  trackIds: number[],
): Promise<ScreenshotOcr[]> {
  void trackIds;

  throw new Error(
    "ocr batch not started",
  );
}

export async function recognizeScreenshots(
  shots: Array<{
    trackId: number;

    screenshotUrl: string;
  }>,
): Promise<Array<ScreenshotOcr & { method: string }>> {
  const worker = await createWorker("eng");

  try {
    const rows: Array<ScreenshotOcr & { method: string }> = [];

    for (const shot of shots) {
      const image = await fetch(
        shot.screenshotUrl,
        {
          headers: {
            "User-Agent": "AppStoreIndexor/0.1",
          },
        },
      );

      if (!image.ok) {
        throw new Error(
          `screenshot HTTP ${image.status}`,
        );
      }

      const bytes = Buffer.from(
        await image.arrayBuffer(),
      );

      const recognized = await worker.recognize(bytes);

      rows.push({
        trackId: shot.trackId,
        screenshotUrl: shot.screenshotUrl,
        text: recognized.data.text.trim(),
        method: OCR_METHOD,
      });
    }

    return rows;
  } finally {
    await worker.terminate();
  }
}
