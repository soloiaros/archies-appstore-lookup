"use client";

import {
  IconMorph,
  TitleMorph,
} from "@/components/AppCard";

import { OutputPanel } from "@/components/OutputPanel";

import { ProvenanceMark } from "@/components/ProvenanceMark";

import { useStaleness } from "@/hooks/useStaleness";

import { unavailable } from "@/lib/provenance/assign";

import { formatRevenueBand } from "@/lib/catalog/revenue";

import type { FactualApp } from "@/lib/types";

import type { ProvenanceTier } from "@/models/provenance";

export function FactualCard({
  query,
  app,
  tier,
  onOpen,
}: {
  query: string;

  app: FactualApp | null;

  tier: ProvenanceTier;

  onOpen?: (trackId: number) => void;
}) {
  const stale = useStaleness(
    app?.metadataFetchedAt ?? null,
  );

  const momentum = app?.momentum ?? unavailable();

  const downloads = app?.downloads ?? unavailable();

  const revenue = app?.revenue ?? unavailable();

  const mrr = app?.mrr ?? unavailable();

  const arr = app?.arr ?? unavailable();

  return (
    <OutputPanel data-shape="factual">
      {app ? (
        <IconMorph trackId={app.trackId}>
          <button
            type="button"
            className="factual-icon"
            onClick={() => {
              onOpen?.(app.trackId);
            }}
          >
            <img
              src={app.iconUrl}
              alt=""
            />
          </button>
        </IconMorph>
      ) : null}

      {app ? (
        <TitleMorph trackId={app.trackId}>
          <h2>
            {app.name}
            {" "}
            <ProvenanceMark tier={tier} />
          </h2>
        </TitleMorph>
      ) : (
        <h2>
          {query}
          {" "}
          <ProvenanceMark tier={tier} />
        </h2>
      )}

      {app ? (
        <p className="clamp">{app.description}</p>
      ) : (
        <p>Not indexed.</p>
      )}

      {app ? (
        <p>
          {app.category}
          {" · "}
          {app.priceLabel}
        </p>
      ) : null}

      <p>
        Rating
        {" "}
        <ProvenanceMark
          tier={app?.ratingTier ?? "unavailable"}
        />
        {app?.ratingAverage !== null
        && app?.ratingAverage !== undefined ? (
          <span>
            {" "}
            {app.ratingAverage}
            {" ("}
            {app.ratingCount}
            {")"}
          </span>
        ) : null}
      </p>

      <p>
        Momentum
        {" "}
        <ProvenanceMark
          tier={momentum.tier}
          method={
            momentum.tier === "estimated"
              ? momentum.method
              : undefined
          }
        />
        {momentum.tier === "estimated" ? (
          <span>
            {" "}
            {momentum.value}
          </span>
        ) : null}
      </p>

      <p>
        Downloads
        {" "}
        <ProvenanceMark
          tier={downloads.tier}
          method={
            downloads.tier === "estimated"
              ? downloads.method
              : undefined
          }
        />
        {downloads.tier === "estimated" ? (
          <span>
            {" "}
            {downloads.value}
          </span>
        ) : null}
      </p>

      <p>
        US store spend / day
        {" "}
        <ProvenanceMark
          tier={revenue.tier}
          method={
            revenue.tier === "estimated"
              ? revenue.method
              : undefined
          }
        />
        {revenue.tier === "estimated" ? (
          <span>
            {" "}
            {formatRevenueBand(revenue.value)}
          </span>
        ) : null}
      </p>

      <p>
        MRR
        {" "}
        <ProvenanceMark
          tier={mrr.tier}
          method={
            mrr.tier === "estimated"
              ? mrr.method
              : undefined
          }
        />
        {mrr.tier === "estimated" ? (
          <span>
            {" "}
            {mrr.value}
          </span>
        ) : null}
      </p>

      <p>
        ARR
        {" "}
        <ProvenanceMark
          tier={arr.tier}
          method={
            arr.tier === "estimated"
              ? arr.method
              : undefined
          }
        />
        {arr.tier === "estimated" ? (
          <span>
            {" "}
            {arr.value}
          </span>
        ) : null}
      </p>

      {stale ? (
        <p>Metadata is stale.</p>
      ) : null}

      {app?.storeUrl ? (
        <p>
          <a
            href={app.storeUrl}
            target="_blank"
            rel="noreferrer"
          >
            App Store
          </a>
        </p>
      ) : null}
    </OutputPanel>
  );
}
