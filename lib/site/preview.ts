import { isIP } from "node:net";

const LIMIT = 500_000;

export type Preview = {
  name: string;

  blurb: string;

  logoUrl: string | null;

  color: string | null;

  url: string;
};

function decode(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function meta(html: string, key: string) {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match?.[1]) {
      return decode(match[1]);
    }
  }

  return null;
}

function isPrivate(ip: string) {
  const lower = ip.toLowerCase();

  if (lower.includes(":")) {
    return lower === "::1"
      || lower.startsWith("fc")
      || lower.startsWith("fd")
      || lower.startsWith("fe80");
  }

  const parts = ip.split(".").map((part) => Number(part));

  if (
    parts.length !== 4
    || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return true;
  }

  const [a, b] = parts;

  if (a === 10 || a === 127 || a === 0) {
    return true;
  }

  if (a === 169 && b === 254) {
    return true;
  }

  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

  if (a === 192 && b === 168) {
    return true;
  }

  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }

  return false;
}

async function assertPublic(url: URL) {
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (
    !host
    || host === "localhost"
    || host.endsWith(".localhost")
    || host.endsWith(".local")
  ) {
    throw new Error("That host is not public.");
  }

  if (isIP(host) && isPrivate(host)) {
    throw new Error("That host is not public.");
  }

  if (isIP(host)) {
    return;
  }

  try {
    const { lookup } = await import("node:dns/promises");

    const records = await lookup(host, { all: true });

    for (const record of records) {
      if (isPrivate(record.address)) {
        throw new Error("That host is not public.");
      }
    }
  } catch (error) {
    if (
      error instanceof Error
      && error.message === "That host is not public."
    ) {
      throw error;
    }
  }
}

function httpsUrl(raw: string) {
  let url: URL;

  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Paste a full https link.");
  }

  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Paste a full https link.");
  }

  return url;
}

async function readLimited(response: Response) {
  const reader = response.body?.getReader();

  if (!reader) {
    return "";
  }

  const chunks: Uint8Array[] = [];

  let size = 0;

  while (size < LIMIT) {
    const step = await reader.read();

    if (step.done) {
      break;
    }

    size += step.value.byteLength;

    chunks.push(step.value);
  }

  await reader.cancel();

  const bytes = new Uint8Array(Math.min(size, LIMIT));

  let offset = 0;

  for (const chunk of chunks) {
    const slice = chunk.subarray(0, bytes.length - offset);

    bytes.set(slice, offset);

    offset += slice.length;

    if (offset >= bytes.length) {
      break;
    }
  }

  return new TextDecoder().decode(bytes);
}

function normalizeColor(input: string | null) {
  if (!input) {
    return null;
  }

  const value = input.trim().toLowerCase();

  if (/^#[0-9a-f]{6}$/.test(value)) {
    return value;
  }

  if (/^#[0-9a-f]{3}$/.test(value)) {
    const [red, green, blue] = value.slice(1).split("");

    return `#${red}${red}${green}${green}${blue}${blue}`;
  }

  return null;
}

function clip(value: string, max: number) {
  const text = value.replace(/\s+/g, " ").trim();

  if (text.length <= max) {
    return text;
  }

  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function siteName(title: string | null, url: URL) {
  const source = title ?? url.hostname.replace(/^www\./, "");

  const cut = source.split(/\s+[—|–|-]\s+|\s+\|\s+/)[0] ?? source;

  return clip(cut, 48);
}

export async function readPreview(raw: string): Promise<Preview> {
  let current = httpsUrl(raw);

  for (let hop = 0; hop < 4; hop += 1) {
    await assertPublic(current);

    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: {
        accept: "text/html",
        "user-agent": "10K sponsor preview",
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");

      if (!location) {
        throw new Error("That page did not load.");
      }

      current = httpsUrl(new URL(location, current).href);

      continue;
    }

    if (!response.ok) {
      throw new Error("That page did not load.");
    }

    const type = response.headers.get("content-type") ?? "";

    if (!type.includes("html")) {
      throw new Error("That URL is not a web page.");
    }

    const html = await readLimited(response);

    const rawTitle = html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? null;

    const title = meta(html, "og:site_name")
      ?? meta(html, "og:title")
      ?? (rawTitle ? decode(rawTitle) : null);

    const description = meta(html, "og:description")
      ?? meta(html, "description")
      ?? "";

    const image = meta(html, "og:image");

    let logoUrl: string | null = null;

    if (image) {
      try {
        const resolved = new URL(image, current);

        if (resolved.protocol === "https:") {
          logoUrl = resolved.href;
        }
      } catch {
        logoUrl = null;
      }
    }

    return {
      name: siteName(title, current),
      blurb: clip(description, 120),
      logoUrl,
      color: normalizeColor(meta(html, "theme-color")),
      url: current.origin + current.pathname,
    };
  }

  throw new Error("Too many redirects.");
}
