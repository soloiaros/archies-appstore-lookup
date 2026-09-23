import { readFileSync } from "node:fs";

export function loadLocalEnv(): void {
  for (const name of [".env.local", ".env"]) {
    let text = "";

    try {
      text = readFileSync(
        name,
        "utf8",
      );
    } catch {
      continue;
    }

    for (const line of text.split("\n")) {
      const trimmed = line.trim();

      if (
        trimmed === ""
        || trimmed.startsWith("#")
      ) {
        continue;
      }

      const eq = trimmed.indexOf("=");

      if (eq <= 0) {
        continue;
      }

      const key = trimmed
        .slice(0, eq)
        .trim();

      const value = trimmed
        .slice(eq + 1)
        .trim();

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

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
