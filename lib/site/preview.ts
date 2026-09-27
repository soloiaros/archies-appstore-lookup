import { BlockList, isIP } from "node:net";

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

function iconHref(html: string) {
  const links = html.match(/<link\b[^>]*>/gi) ?? [];

  const ranked = ["apple-touch-icon", "icon"];

  for (const rel of ranked) {
    for (const tag of links) {
      const relValue = tag.match(/\brel=["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";

      if (!relValue.split(/\s+/).includes(rel)) {
        continue;
      }

      const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];

      if (href && !href.startsWith("data:")) {
        return decode(href);
      }
    }
  }

  return null;
}

const blocked = new BlockList();

for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(address, prefix, "ipv4");
}

blocked.addAddress("::", "ipv6");

blocked.addAddress("::1", "ipv6");

blocked.addSubnet("64:ff9b::", 96, "ipv6");

blocked.addSubnet("2001:db8::", 32, "ipv6");

blocked.addSubnet("fc00::", 7, "ipv6");

blocked.addSubnet("fe80::", 10, "ipv6");

blocked.addSubnet("ff00::", 8, "ipv6");

type Pin = {
  address: string;

  family: 4 | 6;
};

function blockedName(host: string) {
  if (
    !host
    || host === "localhost"
    || host.endsWith(".localhost")
    || host.endsWith(".local")
    || host.endsWith(".internal")
    || host.endsWith(".home.arpa")
    || host.endsWith(".lan")
  ) {
    return true;
  }

  if (isIP(host)) {
    return false;
  }

  if (/^0x[0-9a-f.]+$/i.test(host) || /^\d+$/.test(host)) {
    return true;
  }

  const parts = host.split(".");

  if (
    parts.length !== 4
    && parts.every((part) => /^\d+$/.test(part))
  ) {
    return true;
  }

  return parts.some((part) => /^0\d/.test(part));
}

function assertAddress(ip: string) {
  const kind = isIP(ip);

  if (kind !== 4 && kind !== 6) {
    throw new Error("That host is not public.");
  }

  const type = kind === 6 ? "ipv6" : "ipv4";

  if (blocked.check(ip, type)) {
    throw new Error("That host is not public.");
  }
}

async function resolvePublic(url: URL): Promise<Pin> {
  const host = url.hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLowerCase();

  if (blockedName(host)) {
    throw new Error("That host is not public.");
  }

  if (isIP(host)) {
    assertAddress(host);

    return {
      address: host,
      family: isIP(host) === 6 ? 6 : 4,
    };
  }

  const { lookup } = await import("node:dns/promises");

  let records: Array<{ address: string; family: number }>;

  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error("That host is not public.");
  }

  if (records.length === 0) {
    throw new Error("That host is not public.");
  }

  for (const record of records) {
    assertAddress(record.address);
  }

  return {
    address: records[0].address,
    family: records[0].family === 6 ? 6 : 4,
  };
}

function onWorkers() {
  return typeof navigator !== "undefined"
    && navigator.userAgent === "Cloudflare-Workers";
}

async function loadPage(url: URL, pin: Pin) {
  const init = {
    redirect: "manual" as const,
    signal: AbortSignal.timeout(8000),
    headers: {
      accept: "text/html",
      "user-agent": "10K sponsor preview",
    },
  };

  if (onWorkers()) {
    return fetch(url, init);
  }

  const undici = await import("undici");

  const agent = new undici.Agent({
    connect: {
      lookup(_hostname, options, callback) {
        if (options.all) {
          callback(null, [{ address: pin.address, family: pin.family }]);

          return;
        }

        callback(null, pin.address, pin.family);
      },
    },
  });

  try {
    return await undici.fetch(url, {
      ...init,
      dispatcher: agent,
    }) as unknown as Response;
  } finally {
    await agent.close();
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

  const cut = source.split(/\s+[—–\-|·:]\s+|:\s+/)[0] ?? source;

  return clip(cut, 40);
}

export async function readPreview(raw: string): Promise<Preview> {
  let current = httpsUrl(raw);

  for (let hop = 0; hop < 4; hop += 1) {
    const pin = await resolvePublic(current);

    const response = await loadPage(current, pin);

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

    const image = iconHref(html) ?? meta(html, "og:image");

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
      blurb: clip(description, 90),
      logoUrl,
      color: normalizeColor(meta(html, "theme-color")),
      url: current.origin + current.pathname,
    };
  }

  throw new Error("Too many redirects.");
}
