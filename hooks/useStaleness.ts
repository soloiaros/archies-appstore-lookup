"use client";

import {
  isStale,
  METADATA_MAX_AGE_MS,
} from "@/lib/provenance/staleness";

export function useStaleness(
  fetchedAt: string | null,
): boolean {
  if (!fetchedAt) {
    return false;
  }

  return isStale(
    fetchedAt,
    METADATA_MAX_AGE_MS,
  );
}
