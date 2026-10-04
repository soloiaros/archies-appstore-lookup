import { useLocalSqlite } from "@/lib/site/db";

/** Approximate country centroids for map fallback when city coords are missing. */
const COUNTRY_CENTROID: Record<string, [number, number]> = {
  AD: [1.5, 42.5],
  AE: [54.0, 24.0],
  AF: [66.0, 33.0],
  AL: [20.0, 41.0],
  AM: [45.0, 40.0],
  AR: [-64.0, -34.0],
  AT: [14.5, 47.5],
  AU: [133.0, -27.0],
  AZ: [47.5, 40.5],
  BA: [18.0, 44.0],
  BD: [90.0, 24.0],
  BE: [4.5, 50.5],
  BG: [25.0, 43.0],
  BH: [50.5, 26.0],
  BO: [-65.0, -17.0],
  BR: [-55.0, -10.0],
  BY: [28.0, 53.0],
  CA: [-106.0, 56.0],
  CH: [8.2, 46.8],
  CL: [-71.0, -30.0],
  CN: [105.0, 35.0],
  CO: [-72.0, 4.0],
  CR: [-84.0, 10.0],
  CY: [33.0, 35.0],
  CZ: [15.5, 49.8],
  DE: [10.5, 51.2],
  DK: [10.0, 56.0],
  DO: [-70.7, 19.0],
  DZ: [3.0, 28.0],
  EC: [-78.5, -1.5],
  EE: [26.0, 59.0],
  EG: [30.0, 27.0],
  ES: [-3.7, 40.4],
  ET: [40.0, 9.0],
  FI: [26.0, 64.0],
  FR: [2.5, 46.5],
  GB: [-2.5, 54.0],
  GE: [43.5, 42.0],
  GH: [-1.0, 8.0],
  GR: [22.0, 39.0],
  GT: [-90.5, 15.5],
  HK: [114.2, 22.3],
  HN: [-86.5, 15.0],
  HR: [16.0, 45.2],
  HU: [19.5, 47.2],
  ID: [118.0, -2.0],
  IE: [-8.0, 53.0],
  IL: [35.0, 31.5],
  IN: [79.0, 21.0],
  IQ: [44.0, 33.0],
  IR: [53.0, 32.0],
  IS: [-18.0, 65.0],
  IT: [12.5, 42.5],
  JM: [-77.3, 18.2],
  JO: [36.0, 31.2],
  JP: [138.0, 36.0],
  KE: [38.0, 1.0],
  KG: [75.0, 41.0],
  KH: [105.0, 13.0],
  KR: [127.5, 36.5],
  KW: [47.5, 29.3],
  KZ: [68.0, 48.0],
  LA: [105.0, 18.0],
  LB: [35.8, 33.9],
  LK: [81.0, 7.0],
  LT: [24.0, 56.0],
  LU: [6.1, 49.8],
  LV: [25.0, 57.0],
  MA: [-5.0, 32.0],
  MD: [28.5, 47.0],
  ME: [19.3, 42.7],
  MK: [21.7, 41.6],
  MM: [96.0, 21.0],
  MN: [105.0, 46.0],
  MT: [14.5, 35.9],
  MX: [-102.0, 23.0],
  MY: [112.0, 4.0],
  NG: [8.0, 10.0],
  NL: [5.5, 52.2],
  NO: [9.0, 62.0],
  NP: [84.0, 28.0],
  NZ: [174.0, -41.0],
  PA: [-80.0, 9.0],
  PE: [-76.0, -10.0],
  PH: [122.0, 12.0],
  PK: [69.0, 30.0],
  PL: [19.5, 52.0],
  PR: [-66.5, 18.2],
  PT: [-8.0, 39.5],
  PY: [-58.0, -23.0],
  QA: [51.2, 25.3],
  RO: [25.0, 46.0],
  RS: [21.0, 44.0],
  RU: [100.0, 60.0],
  SA: [45.0, 24.0],
  SE: [15.0, 62.0],
  SG: [103.8, 1.35],
  SI: [14.5, 46.1],
  SK: [19.5, 48.7],
  SN: [-14.5, 14.5],
  SV: [-88.9, 13.8],
  TH: [101.0, 15.0],
  TN: [9.0, 34.0],
  TR: [35.0, 39.0],
  TW: [121.0, 23.5],
  TZ: [35.0, -6.0],
  UA: [32.0, 49.0],
  UG: [32.5, 1.0],
  US: [-98.0, 39.5],
  UY: [-56.0, -33.0],
  UZ: [64.0, 41.0],
  VE: [-66.0, 7.0],
  VN: [108.0, 16.0],
  ZA: [24.0, -29.0],
  ZW: [30.0, -19.0],
};

export type VisitPlace = {
  city: string | null;
  region: string | null;
  country: string | null;
  lat: number | null;
  lon: number | null;
};

type CfGeo = {
  city?: string;
  region?: string;
  regionCode?: string;
  country?: string;
  latitude?: string | number;
  longitude?: string | number;
};

function cleanLabel(value: string | null | undefined) {
  const text = value?.trim() ?? "";

  if (!text || text === "XX" || text === "T1") {
    return null;
  }

  try {
    return decodeURIComponent(text).slice(0, 80);
  } catch {
    return text.slice(0, 80);
  }
}

function parseCoord(value: string | number | null | undefined) {
  if (value == null || value === "") {
    return null;
  }

  const n = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(n)) {
    return null;
  }

  return n;
}

function normalizeCountry(value: string | null | undefined) {
  const code = value?.trim().toUpperCase() ?? "";

  if (!/^[A-Z]{2}$/.test(code) || code === "XX" || code === "T1") {
    return null;
  }

  return code;
}

async function cloudflareGeo(): Promise<CfGeo | null> {
  // Local next has no edge geo; avoid installing the wrangler proxy.
  if (useLocalSqlite()) {
    return null;
  }

  try {
    const mod = await import("@opennextjs/cloudflare");
    const ctx = await mod.getCloudflareContext({ async: true });
    const cf = ctx.cf as CfGeo | undefined;
    return cf ?? null;
  } catch {
    return null;
  }
}

/**
 * Best-effort city/region/coords.
 * On Workers, prefer `getCloudflareContext().cf` (authoritative).
 * Headers are a fallback and ignored when `cf` already has a country.
 */
export async function requestPlace(request: Request): Promise<VisitPlace> {
  const cf = await cloudflareGeo();
  const trustCf = Boolean(
    cf
    && (cf.country || cf.city || cf.latitude != null || cf.longitude != null),
  );

  const city = cleanLabel(
    trustCf ? cf?.city : request.headers.get("cf-ipcity"),
  );
  const region = cleanLabel(
    trustCf
      ? (cf?.region ?? cf?.regionCode)
      : (
        request.headers.get("cf-region")
          ?? request.headers.get("cf-region-code")
          ?? request.headers.get("cf-regioncode")
      ),
  );
  const country = normalizeCountry(
    trustCf ? cf?.country : request.headers.get("cf-ipcountry"),
  );

  let lat = parseCoord(
    trustCf ? cf?.latitude : request.headers.get("cf-iplatitude"),
  );
  let lon = parseCoord(
    trustCf ? cf?.longitude : request.headers.get("cf-iplongitude"),
  );

  if (
    lat == null
    || lon == null
    || lat < -90
    || lat > 90
    || lon < -180
    || lon > 180
  ) {
    lat = null;
    lon = null;
  }

  if ((lat == null || lon == null) && country) {
    const centroid = COUNTRY_CENTROID[country];

    if (centroid) {
      lon = centroid[0];
      lat = centroid[1];
    }
  }

  return { city, region, country, lat, lon };
}

export function countryCentroid(code: string): [number, number] | null {
  return COUNTRY_CENTROID[code] ?? null;
}

export type MapPlace = {
  id: string;
  label: string;
  detail: string | null;
  lat: number;
  lon: number;
  n: number;
};

export function placeLabel(input: {
  city?: string | null;
  region?: string | null;
  countryName?: string | null;
  country?: string | null;
}) {
  const city = input.city?.trim() || null;
  const region = input.region?.trim() || null;
  const country = input.countryName?.trim()
    || input.country?.trim()
    || null;

  if (city && region && region.toLowerCase() !== city.toLowerCase()) {
    return { label: city, detail: region };
  }

  if (city) {
    return { label: city, detail: country };
  }

  if (region) {
    return { label: region, detail: country };
  }

  return { label: country ?? "Unknown", detail: null };
}
