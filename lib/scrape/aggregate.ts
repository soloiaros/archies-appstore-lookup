import type { ChartKind } from "@/models/series";

import { sleep } from "@/lib/scrape/retry";

import {
  categoryFeedUrl,
  fetchChart,
  marketingFeedUrl,
} from "@/lib/scrape/rss";

import type {
  ChartHit,
  ChartSource,
} from "@/lib/scrape/rss";

export const CHART_GAP_MS = 250;

const CHARTS: ChartKind[] = [
  "top-free",
  "top-paid",
  "top-grossing",
];

export type ChartAppearance = {
  trackId: number;

  rank: number;

  chart: ChartKind;

  genreId: number | null;

  country: string;
};

export type FeedReport = {
  chart: ChartKind;

  genreId: number | null;

  source: ChartSource;

  url: string;

  hits: number;

  error: string | null;
};

export type ChartCollection = {
  appearances: ChartAppearance[];

  feeds: FeedReport[];
};

type FeedJob = {
  chart: ChartKind;

  genreId: number | null;

  source: ChartSource;

  url: string;
};

export function chartFeedJobs(
  country: string,
  genreIds: number[],
): FeedJob[] {
  const jobs: FeedJob[] = [];

  for (const chart of CHARTS) {
    if (chart === "top-grossing") {
      // grossing 404

      jobs.push({
        chart,
        genreId: null,
        source: "legacy",
        url: categoryFeedUrl(
          country,
          chart,
          null,
        ),
      });
    } else {
      jobs.push({
        chart,
        genreId: null,
        source: "marketing",
        url: marketingFeedUrl(
          country,
          chart,
        ),
      });
    }

    for (const genreId of genreIds) {
      jobs.push({
        chart,
        genreId,
        source: "legacy",
        url: categoryFeedUrl(
          country,
          chart,
          genreId,
        ),
      });
    }
  }

  return jobs;
}

export async function aggregateCharts(
  country: string,
  genreIds: number[],
  onFeed?: (
    report: FeedReport,
    index: number,
    total: number,
  ) => void,
): Promise<ChartCollection> {
  const jobs = chartFeedJobs(
    country,
    genreIds,
  );

  const appearances: ChartAppearance[] = [];

  const feeds: FeedReport[] = [];

  for (
    let index = 0;
    index < jobs.length;
    index += 1
  ) {
    const job = jobs[index];

    const report = await loadFeed(
      job,
      country,
    );

    if (report.feed.error === null) {
      appearances.push(
        ...report.appearances,
      );
    }

    feeds.push(report.feed);

    onFeed?.(
      report.feed,
      index,
      jobs.length,
    );

    if (index < jobs.length - 1) {
      await sleep(CHART_GAP_MS);
    }
  }

  return {
    appearances,
    feeds,
  };
}

async function loadFeed(
  job: FeedJob,
  country: string,
): Promise<{
  feed: FeedReport;

  appearances: ChartAppearance[];
}> {
  try {
    const hits = await fetchChart(
      job.url,
      job.source,
    );

    return {
      feed: {
        chart: job.chart,
        genreId: job.genreId,
        source: job.source,
        url: job.url,
        hits: hits.length,
        error: null,
      },
      appearances: hits.map(
        (hit) => toAppearance(
          hit,
          job,
          country,
        ),
      ),
    };
  } catch (error) {
    return {
      feed: {
        chart: job.chart,
        genreId: job.genreId,
        source: job.source,
        url: job.url,
        hits: 0,
        error:
          error instanceof Error
            ? error.message
            : "feed failed",
      },
      appearances: [],
    };
  }
}

function toAppearance(
  hit: ChartHit,
  job: FeedJob,
  country: string,
): ChartAppearance {
  return {
    trackId: hit.trackId,
    rank: hit.rank,
    chart: job.chart,
    genreId: job.genreId,
    country,
  };
}
