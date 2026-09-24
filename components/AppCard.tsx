"use client";

import {
  useEffect,
  ViewTransition,
  type ReactElement,
} from "react";

import { ProvenanceMark } from "@/components/ProvenanceMark";

import { DirectionalPage } from "@/components/DirectionalPage";

import type { AppDetail as AppRecord } from "@/lib/catalog/detail";

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

  return (
    <DirectionalPage>
      <div className="app-detail">
        <button
          type="button"
          className="app-detail-back"
          onClick={onBack}
          style={{ viewTransitionName: "detail-back" }}
        >
          ← Search
        </button>

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

        <div className="app-detail-copy">
          <TitleMorph trackId={detail.trackId}>
            <h1>
              {detail.name}
              {" "}
              <ProvenanceMark tier={detail.tier} />
            </h1>
          </TitleMorph>

          <p className="app-detail-mono">
            {detail.sellerName}
          </p>

          <p className="app-detail-meta">
            {detail.primaryGenre}
            {" · "}
            {detail.formattedPrice}

            {detail.matchProbability !== null ? (
              <>
                {" · "}
                {Math.round(detail.matchProbability * 100)}
                %
              </>
            ) : null}
          </p>

          <DetailFields detail={detail} />
        </div>
      </div>
    </DirectionalPage>
  );
}

function DetailFields({
  detail,
}: {
  detail: AppRecord;
}) {
  return (
    <dl className="app-card-fields">
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
