export function typesafeKey(): string | null {
  const key = process.env.TYPE_SAFE_KEY;

  if (!key || key.trim() === "") {
    return null;
  }

  return key;
}

export function itunesCountry(): string {
  const country = process.env.ITUNES_COUNTRY;

  if (!country || country.trim() === "") {
    return "us";
  }

  return country.trim().toLowerCase();
}
