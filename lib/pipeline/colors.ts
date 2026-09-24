import { RawImage } from "@huggingface/transformers";

const HUES: Array<[number, string]> = [
  [12, "red"],
  [38, "orange"],
  [52, "yellow-orange"],
  [66, "yellow"],
  [88, "yellow-green (lime)"],
  [160, "green"],
  [178, "green-blue (teal)"],
  [198, "light blue (cyan)"],
  [236, "blue"],
  [268, "blue-purple (indigo)"],
  [295, "purple"],
  [335, "pink"],
  [350, "pink-red"],
  [361, "red"],
];

export const COLOR_METHOD = "pixel-histogram";

export function colorWords(
  image: RawImage,
): {
  colorText: string;

  colors: string[];
} {
  const sample = coverSquare(
    onWhite(image.clone()),
    48,
  );

  const counts = new Map<string, number>();

  const ring = new Map<string, number>();

  const center = new Map<string, number>();

  let brightness = 0;

  const { data, width, height, channels } = sample;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * channels;

      const r = data[at]! / 255;

      const g = data[at + 1]! / 255;

      const b = data[at + 2]! / 255;

      const name = colorName(r, g, b);

      counts.set(name, (counts.get(name) ?? 0) + 1);

      brightness += (r + g + b) / 3;

      const edge =
        x < width * 0.2
        || x > width * 0.8
        || y < height * 0.2
        || y > height * 0.8;

      const bucket = edge ? ring : center;

      bucket.set(name, (bucket.get(name) ?? 0) + 1);
    }
  }

  const total = width * height;

  const main = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .filter((entry) => entry[1] / total >= 0.04);

  const tone =
    brightness / total < 0.3
      ? "dark overall"
      : brightness / total > 0.72
        ? "light overall"
        : "medium brightness";

  const background =
    [...ring.entries()].sort(
      (left, right) => right[1] - left[1],
    )[0]?.[0] ?? "unknown";

  const middle = [...center.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map((entry) => entry[0])
    .join(" and ");

  const listed = main
    .map(
      (entry) =>
        `${entry[0]} ${Math.round((entry[1] / total) * 100)}%`,
    )
    .join(", ");

  return {
    colorText:
      `Colors by area: ${listed}. `
      + `The background (outer edge) is ${background}. `
      + `The middle of the image is mostly ${middle}. `
      + `The image is ${tone}.`,
    colors: main.slice(0, 3).map((entry) => entry[0]),
  };
}

function colorName(
  r: number,
  g: number,
  b: number,
): string {
  const max = Math.max(r, g, b);

  const min = Math.min(r, g, b);

  const value = max;

  const delta = max - min;

  const saturation = max === 0 ? 0 : delta / max;

  let hue = 0;

  if (delta > 0) {
    if (max === r) {
      hue = ((g - b) / delta) % 6;
    } else if (max === g) {
      hue = (b - r) / delta + 2;
    } else {
      hue = (r - g) / delta + 4;
    }

    hue *= 60;

    if (hue < 0) {
      hue += 360;
    }
  }

  if (value < 0.2) {
    return "black";
  }

  if (saturation < 0.14) {
    if (
      value > 0.75
      && saturation >= 0.045
      && hue >= 15
      && hue <= 70
    ) {
      return "cream or beige";
    }

    if (value > 0.84) {
      return "white";
    }

    if (value > 0.6) {
      return "light gray";
    }

    if (value > 0.35) {
      return "gray";
    }

    return "dark gray";
  }

  const base =
    HUES.find((entry) => hue < entry[0])?.[1] ?? "red";

  if (
    (base === "orange" || base === "yellow-orange")
    && value < 0.55
  ) {
    return "brown";
  }

  const prefix =
    value < 0.5
      ? "dark "
      : saturation < 0.38 && value > 0.78
        ? "pale "
        : "";

  return prefix + base;
}

function onWhite(
  image: RawImage,
): RawImage {
  const rgba = image.rgba();

  const out = new Uint8ClampedArray(
    rgba.width * rgba.height * 3,
  );

  for (
    let index = 0, pixel = 0;
    index < rgba.data.length;
    index += 4
  ) {
    const alpha = rgba.data[index + 3]! / 255;

    out[pixel] = Math.round(
      rgba.data[index]! * alpha + 255 * (1 - alpha),
    );

    out[pixel + 1] = Math.round(
      rgba.data[index + 1]! * alpha + 255 * (1 - alpha),
    );

    out[pixel + 2] = Math.round(
      rgba.data[index + 2]! * alpha + 255 * (1 - alpha),
    );

    pixel += 3;
  }

  return new RawImage(
    out,
    rgba.width,
    rgba.height,
    3,
  );
}

function coverSquare(
  image: RawImage,
  side: number,
): RawImage {
  const scale = side / Math.min(image.width, image.height);

  const width = Math.max(
    side,
    Math.round(image.width * scale),
  );

  const height = Math.max(
    side,
    Math.round(image.height * scale),
  );

  const resized = resizeSync(image, width, height);

  const x = Math.floor((resized.width - side) / 2);

  const y = Math.floor((resized.height - side) / 2);

  const out = new Uint8ClampedArray(side * side * 3);

  for (let row = 0; row < side; row += 1) {
    for (let col = 0; col < side; col += 1) {
      const from =
        ((row + y) * resized.width + (col + x)) * 3;

      const to = (row * side + col) * 3;

      out[to] = resized.data[from]!;

      out[to + 1] = resized.data[from + 1]!;

      out[to + 2] = resized.data[from + 2]!;
    }
  }

  return new RawImage(out, side, side, 3);
}

function resizeSync(
  image: RawImage,
  width: number,
  height: number,
): RawImage {
  const out = new Uint8ClampedArray(width * height * 3);

  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(
      image.height - 1,
      Math.floor((y * image.height) / height),
    );

    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(
        image.width - 1,
        Math.floor((x * image.width) / width),
      );

      const from =
        (sourceY * image.width + sourceX)
        * image.channels;

      const to = (y * width + x) * 3;

      out[to] = image.data[from]!;

      out[to + 1] = image.data[from + 1] ?? image.data[from]!;

      out[to + 2] = image.data[from + 2] ?? image.data[from]!;
    }
  }

  return new RawImage(out, width, height, 3);
}

export async function squareForOcr(
  image: RawImage,
): Promise<RawImage> {
  const rgb = onWhite(image.clone());

  const side = 640;

  const scale = Math.min(
    side / rgb.width,
    side / rgb.height,
  );

  const width = Math.max(
    1,
    Math.round(rgb.width * scale),
  );

  const height = Math.max(
    1,
    Math.round(rgb.height * scale),
  );

  const resized = resizeSync(rgb, width, height);

  const canvas = new Uint8ClampedArray(side * side * 3);

  canvas.fill(255);

  const x0 = Math.floor((side - resized.width) / 2);

  const y0 = Math.floor((side - resized.height) / 2);

  for (let row = 0; row < resized.height; row += 1) {
    for (let col = 0; col < resized.width; col += 1) {
      const from = (row * resized.width + col) * 3;

      const to = ((row + y0) * side + (col + x0)) * 3;

      canvas[to] = resized.data[from]!;

      canvas[to + 1] = resized.data[from + 1]!;

      canvas[to + 2] = resized.data[from + 2]!;
    }
  }

  return new RawImage(canvas, side, side, 3);
}
