import Link from "next/link";

import { HereNow } from "@/components/HereNow";

import { SectionPage } from "@/components/DirectionalPage";

import { Key } from "@/components/ui/Key";

import { loadStats } from "@/lib/site/stats";

import type { CountRow } from "@/lib/site/stats";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90] as const;

const dayLabel = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function rangeOf(value: string | undefined) {
  const days = Number(value);

  if (days === 7 || days === 90) {
    return days;
  }

  return 30;
}

function count(value: number) {
  return value.toLocaleString("en-US");
}

function duration(ms: number | null) {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) {
    return "0s";
  }

  const seconds = Math.round(ms / 1000);

  if (seconds < 90) {
    return `${seconds}s`;
  }

  const minutes = Math.round(seconds / 60);

  return `${minutes}m`;
}

function Bars({
  rows,
  name,
}: {
  rows: Array<CountRow & { flag?: string }>;

  name: (row: CountRow & { flag?: string }) => string;
}) {
  const max = rows.reduce((peak, row) => Math.max(peak, row.n), 0);

  if (rows.length === 0) {
    return <p className="board-note">No visits in this window.</p>;
  }

  return (
    <ol className="bar-list">
      {rows.map((row) => (
        <li key={row.label}>
          <span
            className="bar-fill"
            style={{
              width: max ? `${Math.max(8, (row.n / max) * 100)}%` : "8%",
            }}
          />

          <span className="bar-name">{name(row)}</span>

          <span className="bar-n">{count(row.n)}</span>
        </li>
      ))}
    </ol>
  );
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const params = await searchParams;

  const days = rangeOf(params.d);

  const report = await loadStats(days);

  const first = report.series[0];

  const last = report.series[report.series.length - 1];

  const metrics = [
    ["Visitors", count(report.visitors)],
    ["Pageviews", count(report.pageviews)],
    ["Sessions", count(report.sessions)],
    [
      "Bounce rate",
      report.bounceRate == null
        ? "—"
        : `${Math.round(report.bounceRate * 100)}%`,
    ],
    ["Avg. session", duration(report.avgSessionMs)],
  ] as const;

  return (
    <SectionPage>
      <main className="shell board">
        <header className="board-head">
          <div>
            <p className="board-kicker">Stats</p>

            <h1>Who&apos;s been by</h1>
          </div>

          <div className="board-tools">
            <HereNow />

            <div className="ui-well range-well">
              {RANGES.map((item) => (
                <Key
                  key={item}
                  href={item === 30 ? "/stats" : `/stats?d=${item}`}
                  current={item === days}
                >
                  {item}d
                </Key>
              ))}
            </div>
          </div>
        </header>

        <section className="metric-grid" aria-label="Totals">
          {metrics.map(([label, value]) => (
            <div className="metric" key={label}>
              <p>{label}</p>

              <strong>{value}</strong>
            </div>
          ))}
        </section>

        <section className="board-block">
          <h2>
            Visitors per day
            <span>
              {" "}
              · last
              {" "}
              {days}
              {" "}
              days
            </span>
          </h2>

          <div className="chart">
            <div className="chart-bars">
              {report.series.map((point) => (
                <div className="chart-col" key={point.ts}>
                  <div
                    className="chart-bar"
                    style={{
                      height: report.peak
                        ? `${(point.visitors / report.peak) * 100}%`
                        : "0%",
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="chart-caption">
              <span>{first ? dayLabel.format(first.ts) : ""}</span>

              <span>
                peak
                {" "}
                {count(report.peak)}
                {" "}
                / day
              </span>

              <span>{last ? dayLabel.format(last.ts) : ""}</span>
            </div>
          </div>
        </section>

        <section className="board-block">
          <h2>Top pages</h2>

          <Bars
            rows={report.pages}
            name={(row) => row.label}
          />
        </section>

        <section className="board-block">
          <h2>Referrers</h2>

          <Bars
            rows={report.referrers}
            name={(row) => row.label}
          />
        </section>

        <section className="board-block">
          <h2>Countries</h2>

          <Bars
            rows={report.countries}
            name={(row) => `${row.flag ? `${row.flag} ` : ""}${row.label}`}
          />
        </section>

        <p className="board-foot">
          Counted on this site.
          {" "}
          <Link href="/sponsor">Sponsor a slot</Link>
        </p>
      </main>
    </SectionPage>
  );
}
