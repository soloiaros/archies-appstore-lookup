const MIN_CHART_IDS = 1000;

export function assertFeedCoverage(
  feeds: Array<{ chart: string; genreId: number | null; hits: number; error: string | null }>,
  uniqueIds: number,
): void {
  const overall = ["top-free", "top-paid"].every((chart) =>
    feeds.some((feed) => feed.chart === chart && feed.genreId === null
      && feed.error === null && feed.hits >= 50));
  const grossing = feeds.some((feed) => feed.chart === "top-grossing"
    && feed.genreId === null && feed.error === null && feed.hits >= 20);
  const successes = feeds.filter((feed) => feed.error === null && feed.hits > 0).length;

  if (!overall || !grossing || uniqueIds < MIN_CHART_IDS || successes < feeds.length * 0.8) {
    throw new Error(`Chart coverage unsafe: ${JSON.stringify({
      feeds: feeds.length, successes, uniqueIds, overall, grossing,
    })}`);
  }
}

export function assertMarketCoverage(
  feeds: Array<{ chart: string; genreId: number | null; hits: number; error: string | null }>,
  uniqueIds: number,
): void {
  const healthy = ["top-free", "top-paid", "top-grossing"].every((chart) =>
    feeds.some((feed) => feed.chart === chart && feed.genreId === null
      && feed.error === null && feed.hits >= (chart === "top-grossing" ? 20 : 50)));

  if (!healthy || uniqueIds < 150) {
    throw new Error(`Market chart coverage unsafe: ${JSON.stringify({
      feeds: feeds.length, uniqueIds, healthy,
    })}`);
  }
}
