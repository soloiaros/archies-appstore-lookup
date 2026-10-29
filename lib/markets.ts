export const MARKETS = [
  { code: "us", name: "United States" },
  { code: "ca", name: "Canada" },
  { code: "br", name: "Brazil" },
  { code: "gb", name: "United Kingdom" },
  { code: "de", name: "Germany" },
  { code: "fr", name: "France" },
  { code: "es", name: "Spain" },
  { code: "jp", name: "Japan" },
  { code: "kr", name: "South Korea" },
  { code: "in", name: "India" },
] as const;

export type MarketCode = (typeof MARKETS)[number]["code"];

export const DEFAULT_MARKET: MarketCode = "us";

const codes = new Set<string>(MARKETS.map((market) => market.code));

export function parseMarket(value: unknown): MarketCode | null {
  return typeof value === "string" && codes.has(value.toLowerCase())
    ? value.toLowerCase() as MarketCode
    : null;
}
