import type {
  Citation,
  Cited,
  Estimated,
  Unavailable,
  Verified,
} from "@/models/provenance";

export function unavailable(): Unavailable {
  return {
    tier: "unavailable",
    value: null,
  };
}

export function verified<T>(
  value: T,
): Verified<T> {
  return {
    tier: "verified",
    value,
  };
}

export function estimated<T>(
  value: T,
  method: string,
): Estimated<T> {
  if (method.trim().length === 0) {
    throw new Error(
      "Estimated readings require a method.",
    );
  }

  return {
    tier: "estimated",
    value,
    method,
  };
}

export function cited<T>(
  value: T,
  citation: Citation,
): Cited<T> {
  return {
    tier: "verified",
    value,
    citation,
  };
}
