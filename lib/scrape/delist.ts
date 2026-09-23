import type { AppMetadata } from "@/models/app";

export function isDelisted(
  status: number,
): boolean {
  return status === 404;
}

export function flagDelisted(
  app: AppMetadata,
): AppMetadata {
  // TODO(phase-8)

  return {
    ...app,
    delisted: true,
  };
}
