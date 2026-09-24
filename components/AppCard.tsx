"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { ProvenanceMark } from "@/components/ProvenanceMark";

import type { AppDetail } from "@/lib/catalog/detail";

import type { MatchPick } from "@/components/floor/overlays";

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const FLIGHT_MS = 520;

const PANEL_MS = 480;

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
  onGhost,
}: {
  origin: Origin;

  onClose: () => void;

  onGhost?: (src: string | null) => void;
}) {
  const [detail, setDetail] = useState<
    AppDetail | null
  >(null);

  const [error, setError] = useState<string | null>(
    null,
  );

  const [phase, setPhase] = useState<
    "enter" | "open" | "exit"
  >("enter");

  const [iconLanded, setIconLanded] =
    useState(false);

  const rootRef = useRef<HTMLDivElement>(null);

  const panelRef = useRef<HTMLDivElement>(null);

  const slotRef = useRef<HTMLDivElement>(null);

  const flyerRef = useRef<HTMLImageElement>(null);

  const reduced =
    typeof window !== "undefined"
    && window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

  useEffect(() => {
    onGhost?.(origin.src);

    return () => {
      onGhost?.(null);
    };
  }, [origin.src, onGhost]);

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
    const flyer = flyerRef.current;

    const slot = slotRef.current;

    const panel = panelRef.current;

    const root = rootRef.current;

    if (!flyer || !slot || !panel || !root) {
      return;
    }

    if (reduced) {
      setIconLanded(true);
      setPhase("open");
      return;
    }

    const to = slot.getBoundingClientRect();

    const panelBox = panel.getBoundingClientRect();

    const ox = origin.x + origin.side / 2;

    const oy = origin.y + origin.side / 2;

    const px = panelBox.left + panelBox.width / 2;

    const py = panelBox.top + panelBox.height / 2;

    const startScale = Math.max(
      0.18,
      origin.side / Math.max(panelBox.width, 1),
    );

    panel.style.transformOrigin = `${((ox - panelBox.left) / panelBox.width) * 100}% ${((oy - panelBox.top) / panelBox.height) * 100}%`;
    panel.style.transform = `translate(${ox - px}px, ${oy - py}px) scale(${startScale})`;
    panel.style.opacity = "0.55";

    const dx = origin.x - to.left;

    const dy = origin.y - to.top;

    const scale = origin.side / Math.max(1, to.width);

    flyer.style.transition = "none";
    flyer.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    flyer.style.opacity = "1";

    const kick = window.setTimeout(() => {
      panel.style.transition = `transform ${PANEL_MS}ms ${EASE}, opacity ${PANEL_MS * 0.7}ms ${EASE}`;
      panel.style.transform = "none";
      panel.style.opacity = "1";

      flyer.style.transition = `transform ${FLIGHT_MS}ms ${EASE}`;
      flyer.style.transform = "none";
      setPhase("open");
    }, 32);

    const done = window.setTimeout(() => {
      setIconLanded(true);
    }, FLIGHT_MS + 32);

    return () => {
      window.clearTimeout(kick);
      window.clearTimeout(done);
    };
  }, [origin, reduced]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  });

  function close() {
    if (phase === "exit") {
      return;
    }

    if (reduced) {
      onGhost?.(null);
      onClose();
      return;
    }

    setPhase("exit");
    setIconLanded(false);

    const flyer = flyerRef.current;

    const slot = slotRef.current;

    const panel = panelRef.current;

    if (flyer && slot) {
      const to = slot.getBoundingClientRect();

      const dx = origin.x - to.left;

      const dy = origin.y - to.top;

      const scale =
        origin.side / Math.max(1, to.width);

      flyer.style.transition = `transform ${FLIGHT_MS * 0.85}ms ${EASE}, opacity 200ms ease`;
      flyer.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
      flyer.style.opacity = "0.2";
    }

    if (panel) {
      const panelBox = panel.getBoundingClientRect();

      const ox = origin.x + origin.side / 2;

      const oy = origin.y + origin.side / 2;

      const px = panelBox.left + panelBox.width / 2;

      const py = panelBox.top + panelBox.height / 2;

      const endScale = Math.max(
        0.18,
        origin.side / Math.max(panelBox.width, 1),
      );

      panel.style.transition = `transform ${PANEL_MS * 0.85}ms ${EASE}, opacity 220ms ease`;
      panel.style.transformOrigin = `${((ox - panelBox.left) / panelBox.width) * 100}% ${((oy - panelBox.top) / panelBox.height) * 100}%`;
      panel.style.transform = `translate(${ox - px}px, ${oy - py}px) scale(${endScale})`;
      panel.style.opacity = "0";
    }

    window.setTimeout(() => {
      onGhost?.(null);
      onClose();
    }, PANEL_MS);
  }

  return (
    <div
      ref={rootRef}
      className="app-card-root"
      data-phase={phase}
      role="dialog"
      aria-modal="true"
      aria-label={detail?.name ?? "App"}
    >
      <button
        type="button"
        className="app-card-scrim"
        aria-label="Close"
        onClick={close}
      />

      <div
        ref={panelRef}
        className="app-card-panel"
      >
        <button
          type="button"
          className="app-card-back"
          onClick={close}
        >
          <span aria-hidden>←</span>
          Back
        </button>

        <div className="app-card-body">
          <div className="app-card-media">
            <div
              ref={slotRef}
              className="app-card-icon-slot"
            >
              <img
                ref={flyerRef}
                className="app-card-flyer"
                src={origin.src}
                alt=""
                draggable={false}
                data-landed={
                  iconLanded
                    ? "true"
                    : "false"
                }
              />
            </div>
          </div>

          <div
            className="app-card-meta"
            data-ready={
              detail || error
                ? "true"
                : "false"
            }
          >
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
