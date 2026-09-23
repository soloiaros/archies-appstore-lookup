"use client";

import type { QueryShape } from "@/lib/types";

export function useRoute(
  shape: QueryShape | null,
): QueryShape | "idle" {
  if (!shape) {
    return "idle";
  }

  return shape;
}
