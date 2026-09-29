"use client";

import {
  useEffect,
  useRef,
  useState,
  ViewTransition,
  type ReactElement,
  type ReactNode,
} from "react";

import { DirectionalPage } from "@/components/DirectionalPage";

import { ProvenanceMark } from "@/components/ProvenanceMark";

import { formatRevenueBand } from "@/lib/catalog/revenue";

import type { AppDetail as AppRecord } from "@/lib/catalog/detail";

import type { ProvenanceTier, Reading } from "@/models/provenance";

export function iconTransitionName(
  trackId: number,
) {
  return `app-icon-${trackId}`;
}

export function titleTransitionName(
  trackId: number,
) {
  return `app-title-${trackId}`;
}

export function IconMorph({
  trackId,
  onSettled,
  children,
}: {
  trackId: number;

  onSettled?: () => void;

  children: ReactElement;
}) {
  return (
    <ViewTransition
      name={iconTransitionName(trackId)}
      share="morph"
      default="none"
      onShare={
        onSettled
          ? () => onSettled
          : undefined
      }
    >
      {children}
    </ViewTransition>
  );
}

export function TitleMorph({
  trackId,
  children,
}: {
  trackId: number;

  children: ReactElement;
}) {
  return (
    <ViewTransition
      name={titleTransitionName(trackId)}
      share="text-morph"
      default="none"
    >
      {children}
    </ViewTransition>
  );
}

type Shown = {
  value: string;

  tier: ProvenanceTier;

  method?: string;
};

function show<T>(
  reading: Reading<T>,
  format: (value: T) => string,
): Shown {
  if (reading.tier === "unavailable") {
    return { value: "—", tier: "unavailable" };
  }

  return {
    value: format(reading.value),
    tier: reading.tier,
    method: reading.tier === "estimated" ? reading.method : undefined,
  };
}

const text = (value: string) => value;

export function AppDetail({
  detail,
  onBack,
  onFlightEnd,
}: {
  detail: AppRecord;

  onBack: () => void;

  onFlightEnd?: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onBack();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [onBack]);

  const revenue = show(detail.revenue, formatRevenueBand);

  const mrr = show(detail.mrr, text);

  const arr = show(detail.arr, text);

  const downloads = show(detail.downloads, text);

  const momentum = show(detail.momentum, (value) => value.toLocaleString("en-US"));

  const rating = detail.rating.average;

  return (
    <DirectionalPage>
      <div className="app-detail">
        <div className="app-page">
          <button
            type="button"
            className="ui-key app-detail-back"
            onClick={onBack}
            style={{ viewTransitionName: "detail-back" }}
          >
            ← Search
          </button>

          <header className="app-hero">
            <div className="app-detail-hero-wrap">
              <IconMorph
                trackId={detail.trackId}
                onSettled={onFlightEnd}
              >
                <img
                  className="app-detail-hero"
                  src={detail.iconUrl}
                  alt=""
                  draggable={false}
                />
              </IconMorph>
            </div>

            <div className="app-hero-copy">
              <TitleMorph trackId={detail.trackId}>
                <h1>{detail.name}</h1>
              </TitleMorph>

              <p className="app-hero-seller">{detail.sellerName}</p>

              <p className="app-chips">
                <span>{detail.primaryGenre}</span>

                <span>{detail.formattedPrice}</span>

                {detail.matchProbability !== null ? (
                  <span>
                    {Math.round(detail.matchProbability * 100)}
                    % match
                  </span>
                ) : null}

                {detail.delisted ? <span>Delisted</span> : null}
              </p>
            </div>

            <a
              className="ui-key ui-key-solid app-store-link"
              href={detail.storeUrl}
              target="_blank"
              rel="noreferrer"
            >
              App Store ↗
            </a>
          </header>

          <section className="app-stats" aria-label="Key numbers">
            <Stat
              label="Rating"
              tier={detail.rating.tier}
              value={
                rating !== null ? (
                  <>
                    <span className="app-star" aria-hidden>★</span>
                    {rating.toFixed(1)}
                  </>
                ) : "—"
              }
              note={
                detail.rating.count !== null
                  ? `${detail.rating.count.toLocaleString("en-US")} ratings`
                  : undefined
              }
            />

            <Stat
              label="US spend / day"
              tier={revenue.tier}
              value={revenue.value}
              note={revenue.method}
            />

            <Stat
              label="MRR"
              tier={mrr.tier}
              value={mrr.value}
              note={mrr.method}
            />

            <Stat
              label="ARR"
              tier={arr.tier}
              value={arr.value}
              note={arr.method}
            />
          </section>

          <section className="app-substats" aria-label="More numbers">
            <MiniStat label="Downloads / mo" shown={downloads} />

            <MiniStat label="Momentum" shown={momentum} />

            <MiniStat
              label="Released"
              shown={{ value: formatDate(detail.releaseDate), tier: "verified" }}
            />

            <MiniStat
              label="Updated"
              shown={{
                value: formatDate(detail.currentVersionReleaseDate),
                tier: "verified",
              }}
            />
          </section>

          {detail.screenshotUrls.length > 0 ? (
            <section className="app-block" aria-label="Screenshots">
              <Shots urls={detail.screenshotUrls} />
            </section>
          ) : null}

          <section className="app-block" aria-labelledby="about-title">
            <h2 id="about-title">About</h2>

            <About text={detail.description} />
          </section>

          <section className="app-block" aria-labelledby="facts-title">
            <h2 id="facts-title">Details</h2>

            <dl className="app-facts">
              <Fact label="Seller">{detail.sellerName}</Fact>

              {detail.genres.length > 0 ? (
                <Fact label="Genres">{detail.genres.join(", ")}</Fact>
              ) : null}

              <Fact label="Version">{detail.version || "—"}</Fact>

              <Fact label="Age rating">{detail.contentAdvisoryRating || "—"}</Fact>

              {detail.signals ? (
                <Fact label="Icon colour">{detail.signals.colorText || "—"}</Fact>
              ) : null}

              <Fact label="Fetched">{formatDate(detail.metadataFetchedAt)}</Fact>

              <Fact label="Bundle" wide>
                <span className="app-card-mono">{detail.bundleId}</span>
              </Fact>
            </dl>

            {detail.tags.length > 0 ? (
              <p className="app-card-tags">
                {detail.tags.map((tag) => (
                  <span
                    key={tag.tagId}
                    className="app-card-tag"
                  >
                    {tag.tagId}
                  </span>
                ))}
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </DirectionalPage>
  );
}

function Stat({
  label,
  value,
  tier,
  note,
}: {
  label: string;

  value: ReactNode;

  tier: ProvenanceTier;

  note?: string;
}) {
  return (
    <div className="app-stat">
      <div className="app-stat-head">
        <span>{label}</span>

        <ProvenanceMark tier={tier} />
      </div>

      <strong>{value}</strong>

      {note ? (
        <p title={note}>{note}</p>
      ) : null}
    </div>
  );
}

function MiniStat({
  label,
  shown,
}: {
  label: string;

  shown: Shown;
}) {
  return (
    <div className="app-mini" title={shown.method}>
      <span>{label}</span>

      <strong>{shown.value}</strong>

      {shown.tier !== "verified" ? (
        <ProvenanceMark tier={shown.tier} />
      ) : null}
    </div>
  );
}

function Fact({
  label,
  wide,
  children,
}: {
  label: string;

  wide?: boolean;

  children: ReactNode;
}) {
  return (
    <div className={wide ? "app-fact app-fact-wide" : "app-fact"}>
      <dt>{label}</dt>

      <dd>{children}</dd>
    </div>
  );
}

function Shots({
  urls,
}: {
  urls: string[];
}) {
  const row = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = row.current;

    if (!node) {
      return;
    }

    const onWheel = (event: WheelEvent) => {
      if (
        Math.abs(event.deltaX)
        > Math.abs(event.deltaY)
      ) {
        return;
      }

      const scroller = node.closest(".app-detail");

      if (!(scroller instanceof HTMLElement)) {
        return;
      }

      scroller.scrollTop += event.deltaY;
      event.preventDefault();
    };

    node.addEventListener("wheel", onWheel, {
      passive: false,
    });

    return () => {
      node.removeEventListener("wheel", onWheel);
    };
  }, []);

  return (
    <div
      ref={row}
      className="app-card-shots"
    >
      {urls.map((url) => (
        <img
          key={url}
          src={url}
          alt=""
          loading="lazy"
        />
      ))}
    </div>
  );
}

function About({
  text,
}: {
  text: string;
}) {
  const body = useRef<HTMLParagraphElement>(null);

  const [open, setOpen] = useState(false);

  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const node = body.current;

    if (!node || open) {
      return;
    }

    setOverflows(
      node.scrollHeight > node.clientHeight + 1,
    );
  }, [text, open]);

  return (
    <>
      <p
        ref={body}
        className={
          open
            ? "app-card-about"
            : "app-card-about is-clamped"
        }
      >
        {text}
      </p>

      {overflows ? (
        <button
          type="button"
          className="text-button app-card-more"
          onClick={() => {
            setOpen((value) => !value);
          }}
        >
          {open ? "Show less" : "Show more"}
        </button>
      ) : null}
    </>
  );
}

function formatDate(
  value: string,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
  );
}
