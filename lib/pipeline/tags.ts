export const TAG_PASS_LIMIT = 50;

export async function tagApps(
  trackIds: number[],
): Promise<never> {
  const ids = [
    ...new Set(trackIds),
  ];

  if (ids.length !== TAG_PASS_LIMIT) {
    throw new Error(
      `tag pass refused: ${ids.length} ids`,
    );
  }

  throw new Error(
    "tags assigned offline, not via API",
  );
}
