const DEFAULT_CENTS = 40_000;

export function sponsorPriceCents(): number {
  const raw = process.env.SPONSOR_PRICE_CENTS;

  if (!raw) {
    return DEFAULT_CENTS;
  }

  const cents = Number(raw);

  if (!Number.isInteger(cents) || cents < 50) {
    return DEFAULT_CENTS;
  }

  return cents;
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
