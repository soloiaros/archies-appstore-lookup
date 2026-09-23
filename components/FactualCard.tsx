"use client";

import { ProvenanceMark } from "@/components/ProvenanceMark";

import { useStaleness } from "@/hooks/useStaleness";

import { unavailable } from "@/lib/provenance/assign";

import type { FactualApp } from "@/lib/types";

import type { ProvenanceTier } from "@/models/provenance";

export function FactualCard({
  query,
  app,
  tier,
}: {
  query: string;

  app: FactualApp | null;

  tier: ProvenanceTier;
}) {
  const stale = useStaleness(
    app?.metadataFetchedAt ?? null,
  );

  const momentum = app?.momentum ?? unavailable();

  const downloads = app?.downloads ?? unavailable();

  return (
    <article data-shape="factual">
      <h2>
        {app?.name ?? query}
        {" "}
        <ProvenanceMark tier={tier} />
      </h2>

      {app ? (
        <p>{app.description}</p>
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

      {stale ? (
        <p>Metadata is stale.</p>
      ) : null}
    </article>
  );
}
