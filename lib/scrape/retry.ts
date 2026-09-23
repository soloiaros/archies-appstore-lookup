export async function withLookupRetry<T>(
  run: () => Promise<T>,
): Promise<T> {
  // TODO(phase-8)

  return run();
}
