import { readFileSync } from "node:fs";

function readDotEnv(name: ".env.local" | ".env") {
  try {
    return readFileSync(
      /*turbopackIgnore: true*/ name,
      "utf8",
    );
  } catch {
    return null;
  }
}

export function loadLocalEnv(): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  for (const text of [readDotEnv(".env.local"), readDotEnv(".env")]) {
    if (text == null) {
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
  const key =
    process.env.OPENROUTER_API_KEY
    || process.env.TYPE_SAFE_KEY;

  if (!key || key.trim() === "") {
    return null;
  }

  return key.trim();
}

export function itunesCountry(): string {
  const country = process.env.ITUNES_COUNTRY;

  if (!country || country.trim() === "") {
    return "us";
  }

  return country.trim().toLowerCase();
}
