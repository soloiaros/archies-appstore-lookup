import { isIP } from "node:net";

const YEAR = 60 * 60 * 24 * 365;

const HALF_HOUR = 60 * 30;

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type VisitIds = {
  vid: string;

  sid: string;
};

function readCookie(header: string, name: string) {
  const match = header.match(
    new RegExp(`(?:^|; )${name}=([^;]*)`),
  );

  if (!match?.[1]) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function bake(
  name: string,
  value: string,
  maxAge: number,
) {
  const secure = process.env.NODE_ENV === "production"
    ? "; Secure"
    : "";

  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

export function visitIds(request: Request): {
  ids: VisitIds;

  cookies: string[];
} {
  const header = request.headers.get("cookie") ?? "";

  const vid = visitorId(header, "vid");

  const sid = visitorId(header, "sid");

  return {
    ids: { vid, sid },
    cookies: [
      bake("vid", vid, YEAR),
      bake("sid", sid, HALF_HOUR),
    ],
  };
}

export function applyCookies(
  response: Response,
  cookies: string[],
) {
  for (const cookie of cookies) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}

function visitorId(header: string, name: string) {
  const value = readCookie(header, name);

  if (value && ID.test(value)) {
    return value.toLowerCase();
  }

  return crypto.randomUUID();
}

export function clientIp(request: Request) {
  const cf = request.headers.get("cf-connecting-ip")?.trim() ?? "";

  if (isIP(cf)) {
    return cf.toLowerCase();
  }

  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim() ?? "";

  if (isIP(forwarded)) {
    return forwarded.toLowerCase();
  }

  return "unknown";
}

export function requestCountry(request: Request) {
  const header = request.headers.get("cf-ipcountry");

  if (!header || !/^[A-Za-z]{2}$/.test(header)) {
    return null;
  }

  const code = header.toUpperCase();

  if (code === "XX" || code === "T1") {
    return null;
  }

  return code;
}

export function requestHost(request: Request) {
  const forwarded = request.headers.get("x-forwarded-host");

  const host = forwarded ?? request.headers.get("host") ?? "";

  return host.split(",")[0]?.trim().replace(/:\d+$/, "") ?? "";
}

export function referrerHost(
  referrer: unknown,
  siteHost: string,
) {
  if (typeof referrer !== "string" || !referrer) {
    return null;
  }

  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");

    const ours = siteHost.replace(/^www\./, "");

    if (!host || host === ours) {
      return null;
    }

    return host.slice(0, 80);
  } catch {
    return null;
  }
}

export function cleanPath(input: unknown) {
  if (typeof input !== "string" || !input.startsWith("/")) {
    return null;
  }

  if (input.startsWith("//") || input.length > 180) {
    return null;
  }

  const path = input.split("?")[0]?.split("#")[0] ?? "";

  if (!path.startsWith("/") || path.startsWith("//")) {
    return null;
  }

  if (path.startsWith("/api") || path.startsWith("/_next")) {
    return null;
  }

  return path;
}
