"use client";

import {
  useEffect,
  useState,
  ViewTransition,
  type ReactElement,
} from "react";

import { ProvenanceMark } from "@/components/ProvenanceMark";

import type { AppDetail } from "@/lib/catalog/detail";

import type { MatchPick } from "@/components/floor/overlays";

export function iconTransitionName(
  trackId: number,
) {
  return `app-icon-${trackId}`;
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
      share="icon-morph"
      enter="none"
      exit="none"
      update="none"
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

type Origin = {
  x: number;

  y: number;

  side: number;

  src: string;

  trackId: number;

  probability: number | null;
};

export function AppCard({
  origin,
  onClose,
  onFlightEnd,
}: {
  origin: Origin;

  onClose: () => void;

  onFlightEnd?: () => void;
}) {
  const [detail, setDetail] = useState<
    AppDetail | null
  >(null);

  const [error, setError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let gone = false;

    void (async () => {
      try {
        const query =
          origin.probability === null
            ? ""
            : `?p=${origin.probability}`;

        const response = await fetch(
          `/api/app/${origin.trackId}${query}`,
        );

        const data: unknown =
          await response.json();

        if (gone) {
          return;
        }

        if (!response.ok) {
          setError(
            isError(data)
              ? data.error
              : "Could not load app.",
          );

          return;
        }

        setDetail(data as AppDetail);
      } catch {
        if (!gone) {
          setError("Could not load app.");
        }
      }
    })();

    return () => {
      gone = true;
    };
  }, [origin.trackId, origin.probability]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <ViewTransition
      enter="card-fade"
      exit="card-fade"
      update="none"
      default="none"
    >
      <div
        className="app-card-root"
        role="dialog"
        aria-modal="true"
        aria-label={detail?.name ?? "App"}
      >
        <button
          type="button"
          className="app-card-scrim"
          aria-label="Close"
          onClick={onClose}
        />

        <div className="app-card-panel">
          <button
            type="button"
            className="app-card-back"
            onClick={onClose}
          >
            <span aria-hidden>←</span>
            Back
          </button>

          <div className="app-card-body">
            <div className="app-card-media">
              <div className="app-card-icon-slot">
                <IconMorph
                  trackId={origin.trackId}
                  onSettled={onFlightEnd}
                >
                  <img
                    className="app-card-flyer"
                    src={origin.src}
                    alt=""
                    draggable={false}
                  />
                </IconMorph>
              </div>
            </div>

            <div className="app-card-meta">
            {error ? (
              <p className="app-card-error">
                {error}
              </p>
            ) : null}

            {!detail && !error ? (
              <p className="app-card-loading">
                Loading…
              </p>
            ) : null}

            {detail ? (
              <DetailFields detail={detail} />
            ) : null}
          </div>
        </div>
      </div>
    </div>
    </ViewTransition>
  );
}

function DetailFields({
  detail,
}: {
  detail: AppDetail;
}) {
  return (
    <dl className="app-card-fields">
      <Field label="Name">
        {detail.name}
        {" "}
        <ProvenanceMark tier={detail.tier} />
      </Field>

      {detail.matchProbability !== null ? (
        <Field label="Match">
          {Math.round(
            detail.matchProbability * 100,
          )}
          %
        </Field>
      ) : null}

      <Field label="Seller">
        {detail.sellerName}
      </Field>

      <Field label="Category">
        {detail.primaryGenre}
      </Field>

      {detail.genres.length > 0 ? (
        <Field label="Genres">
          {detail.genres.join(", ")}
        </Field>
      ) : null}

      <Field label="Price">
        {detail.formattedPrice}
      </Field>

      <Field label="Version">
        {detail.version}
      </Field>

      <Field label="Released">
        {formatDate(detail.releaseDate)}
      </Field>

      <Field label="Updated">
        {formatDate(
          detail.currentVersionReleaseDate,
        )}
      </Field>

      <Field label="Rating">
        <ProvenanceMark
          tier={detail.rating.tier}
        />
        {detail.rating.average !== null ? (
          <span>
            {" "}
            {detail.rating.average.toFixed(1)}
            {" ("}
            {detail.rating.count?.toLocaleString()}
            {")"}
          </span>
        ) : (
          <span> —</span>
        )}
      </Field>

      <Field label="Momentum">
        <ProvenanceMark
          tier={detail.momentum.tier}
          method={
            detail.momentum.tier === "estimated"
              ? detail.momentum.method
              : undefined
          }
        />
        {detail.momentum.tier === "estimated" ? (
          <span>
            {" "}
            {detail.momentum.value}
          </span>
        ) : (
          <span> —</span>
        )}
      </Field>

      <Field label="Downloads">
        <ProvenanceMark
          tier={detail.downloads.tier}
          method={
            detail.downloads.tier === "estimated"
              ? detail.downloads.method
              : undefined
          }
        />
        {detail.downloads.tier === "estimated" ? (
          <span>
            {" "}
            {detail.downloads.value}
          </span>
        ) : (
          <span> —</span>
        )}
      </Field>

      <Field label="Age rating">
        {detail.contentAdvisoryRating}
      </Field>

      <Field label="Bundle">
        <span className="app-card-mono">
          {detail.bundleId}
        </span>
      </Field>

      {detail.delisted ? (
        <Field label="Status">
          Delisted
        </Field>
      ) : null}

      {detail.signals ? (
        <>
          <Field label="Icon color">
            <ProvenanceMark
              tier={detail.signals.tier}
              method={detail.signals.method}
            />
            {" "}
            {detail.signals.colorText || "—"}
          </Field>

          <Field label="Icon letters">
            {detail.signals.letters || "—"}
          </Field>
        </>
      ) : null}

      {detail.tags.length > 0 ? (
        <Field label="Tags">
          <span className="app-card-tags">
            {detail.tags.map((tag) => (
              <span
                key={tag.tagId}
                className="app-card-tag"
              >
                {tag.tagId}
                {" "}
                <ProvenanceMark
                  tier={tag.tier}
                  method={tag.method}
                />
              </span>
            ))}
          </span>
        </Field>
      ) : null}

      <Field label="About">
        <p className="app-card-about">
          {detail.description}
        </p>
      </Field>

      {detail.screenshotUrls.length > 0 ? (
        <Field label="Screens">
          <div className="app-card-shots">
            {detail.screenshotUrls
              .slice(0, 6)
              .map((url) => (
                <img
                  key={url}
                  src={url}
                  alt=""
                  loading="lazy"
                />
              ))}
          </div>
        </Field>
      ) : null}

      <Field label="Store">
        <a
          href={detail.storeUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open in App Store
        </a>
      </Field>

      <Field label="Fetched">
        {formatDate(detail.metadataFetchedAt)}
      </Field>
    </dl>
  );
}

function Field({
  label,
  children,
}: {
  label: string;

  children: React.ReactNode;
}) {
  return (
    <div className="app-card-field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
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
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
  );
}

function isError(
  value: unknown,
): value is { error: string } {
  return (
    typeof value === "object"
    && value !== null
    && "error" in value
    && typeof (
      value as { error: unknown }
    ).error === "string"
  );
}

export function originFromPick(
  pick: MatchPick,
): Origin {
  return {
    x: pick.x,
    y: pick.y,
    side: pick.side,
    src: pick.match.src,
    trackId: pick.match.trackId,
    probability: pick.match.probability,
  };
}
