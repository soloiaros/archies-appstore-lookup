"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { addTransitionType } from "react";

import { AppDetail } from "@/components/AppCard";

import { ComparativeList } from "@/components/ComparativeList";

import { SearchPage } from "@/components/DirectionalPage";

import { FactualCard } from "@/components/FactualCard";

import {
  IconFloor,
  type FloorApi,
  type Seat,
} from "@/components/IconFloor";

import { NoticeSurface } from "@/components/NoticeSurface";

import { OutputShell } from "@/components/OutputShell";

import { LiveStats } from "@/components/LiveStats";

import { SearchComposer } from "@/components/SearchComposer";

import { StoreMark } from "@/components/ui/StoreMark";

import type { MatchPick } from "@/components/floor/overlays";

import type { Sheet } from "@/components/floor/atlas";

import { useQuery } from "@/hooks/useQuery";

import type { AppDetail as AppRecord } from "@/lib/catalog/detail";

import { useRoute } from "@/hooks/useRoute";

type PileIcon = {
  id: string;

  src: string;

  at: number;
};

export function QueryScreen({
  icons,
  indexed,
  sheet,
}: {
  icons: PileIcon[];

  indexed: number;

  sheet: Sheet | null;
}) {
  const [pileIcons] = useState(() => icons);

  const [pileCap, setPileCap] = useState<number | null>(null);

  useLayoutEffect(() => {
    setPileCap(
      window.matchMedia("(max-width: 720px)").matches
        ? 150
        : 300,
    );
  }, []);

  const [text, setText] = useState("");

  const { state, run } = useQuery();

  const floor = useRef<FloorApi | null>(null);

  const bar = useRef<HTMLDivElement>(null);

  const [floorAt, setFloorAt] = useState(0);

  const onFloorReady = useCallback(() => {
    setFloorAt((n) => n + 1);
  }, []);

  const [detail, setDetail] = useState<
    AppRecord | null
  >(null);

  const detailRef = useRef(detail);

  detailRef.current = detail;

  const ready = useRef(
    new Map<number, AppRecord>(),
  );

  const [, startTransition] = useTransition();

  const wasOpen = useRef(false);

  const shape =
    state.phase === "done"
      ? state.answer.shape
      : null;

  const route = useRoute(shape);

  const drawn = useMemo(
    () =>
      pileCap == null
        ? []
        : pileIcons.slice(0, Math.min(pileCap, pileIcons.length)),
    [pileIcons, pileCap],
  );

  const sources = useMemo(
    () => drawn.map((icon) => icon.src),
    [drawn],
  );

  const cells = useMemo(
    () => drawn.map((icon) => icon.at),
    [drawn],
  );

  const matches = useMemo(() => {
    if (
      state.phase !== "done"
      || state.answer.shape !== "discovery"
      || (
        state.answer.scoring !== "scored"
        && state.answer.hits.length === 0
      )
    ) {
      return [];
    }

    return state.answer.hits.map((hit) => ({
      src: hit.iconUrl,
      probability: hit.probability,
      title: hit.name,
      tagline: undefined as string | undefined,
      detail: undefined as string | undefined,
      trackId: hit.trackId,
    }));
  }, [state]);

  useEffect(() => {
    if (!matches.length) {
      return;
    }

    floor.current?.select(matches, () => {
      const box = bar.current?.getBoundingClientRect();

      return {
        x:
          (box?.left ?? 0)
          + (box?.width ?? window.innerWidth) / 2,
        above: box?.top ?? window.innerHeight / 2,
      };
    });
  }, [matches, floorAt]);

  const reset = useCallback(() => {
    floor.current?.release();
  }, []);

  const submit = useCallback(
    (raw: string) => {
      const query = raw.trim();

      if (
        (
          state.phase === "done"
          && (
            (
              state.answer.shape === "discovery"
              && state.answer.query === query
            )
            || (
              state.answer.shape === "factual"
              && state.answer.query === query
            )
            || (
              state.answer.shape === "comparative"
              && state.answer.query === query
            )
          )
        )
        || (
          state.phase === "loading"
          && state.query === query
        )
      ) {
        return;
      }

      void run(query);
    },
    [state, run],
  );

  const lastKey = useRef(0);

  const onType = useCallback(
    (value: string) => {
      if (matches.length) {
        floor.current?.release();
      }

      setDetail(null);
      floor.current?.ghost(null);
      setText(value);

      const now = performance.now();

      const gap = now - lastKey.current;

      lastKey.current = now;

      if (gap < 1200) {
        floor.current?.shake(
          Math.min(1, 90 / Math.max(gap, 50)),
        );
      }
    },
    [matches.length],
  );

  const endFlight = useCallback(() => {
    if (detailRef.current) {
      return;
    }

    floor.current?.ghost(null);
  }, []);

  const loadDetail = useCallback(
    async (
      trackId: number,
      probability: number | null,
    ) => {
      const cached = ready.current.get(trackId);

      if (cached) {
        return cached;
      }

      const query =
        probability === null
          ? ""
          : `?p=${probability}`;

      const response = await fetch(
        `/api/app/${trackId}${query}`,
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as AppRecord;

      if (
        !data
        || data.trackId !== trackId
      ) {
        return null;
      }

      ready.current.set(trackId, data);

      return data;
    },
    [],
  );

  const showDetail = useCallback(
    (next: AppRecord) => {
      startTransition(() => {
        addTransitionType("nav-forward");
        setDetail(next);
      });
    },
    [],
  );

  const closeDetail = useCallback(() => {
    startTransition(() => {
      addTransitionType("nav-back");
      setDetail(null);
    });
  }, []);

  const openById = useCallback(
    async (
      trackId: number,
      probability: number | null,
      ghostSrc?: string,
    ) => {
      const next = await loadDetail(
        trackId,
        probability,
      );

      if (!next) {
        return;
      }

      if (ghostSrc) {
        floor.current?.ghost(ghostSrc);
      }

      showDetail(next);
    },
    [loadDetail, showDetail],
  );

  const onSeat = useCallback(
    (seat: Seat) => {
      void openById(
        seat.trackId,
        seat.probability,
        seat.src,
      );
    },
    [openById],
  );

  const onMatchOpen = useCallback(
    (pick: MatchPick) => {
      void openById(
        pick.match.trackId,
        pick.match.probability,
        pick.match.src,
      );
    },
    [openById],
  );

  useEffect(() => {
    if (detail) {
      wasOpen.current = true;

      return;
    }

    if (!wasOpen.current) {
      return;
    }

    const id = window.setTimeout(() => {
      floor.current?.ghost(null);
    }, 700);

    return () => {
      window.clearTimeout(id);
    };
  }, [detail]);

  useEffect(() => {
    const jobs: {
      trackId: number;

      probability: number | null;
    }[] = matches.map((match) => ({
      trackId: match.trackId,
      probability: match.probability,
    }));

    if (
      state.phase === "done"
      && state.answer.shape === "factual"
      && state.answer.app
    ) {
      jobs.push({
        trackId: state.answer.app.trackId,
        probability: null,
      });
    }

    let stop = false;

    for (const job of jobs) {
      if (ready.current.has(job.trackId)) {
        continue;
      }

      void loadDetail(
        job.trackId,
        job.probability,
      ).then((row) => {
        if (stop || !row) {
          return;
        }
      });
    }

    return () => {
      stop = true;
    };
  }, [matches, state, loadDetail]);

  const discoveryTier =
    state.phase === "done"
    && state.answer.shape === "discovery"
      ? state.answer.tier
      : null;

  const busy = state.phase === "loading";

  const notice =
    state.phase === "error"
      ? {
          message: state.message,
          retry: state.query,
        }
      : state.phase === "done"
        && state.answer.shape === "discovery"
        && state.answer.scoring === "unavailable"
        && state.answer.hits.length === 0
        ? {
            message:
              state.answer.scoringNote
              ?? "Scoring needs an OpenRouter key.",
            retry: null as string | null,
          }
        : state.phase === "done"
          && state.answer.shape === "discovery"
          && state.answer.scoring === "scored"
          && state.answer.hits.length === 0
          ? {
              message:
                "Nothing cleared the certainty threshold.",
              retry: null as string | null,
            }
          : null;

  const answerShown =
    state.phase === "done"
    && (
      (route === "factual" && state.answer.shape === "factual")
      || (route === "comparative" && state.answer.shape === "comparative")
    );

  const discoveryShown =
    state.phase === "done"
    && state.answer.shape === "discovery"
    && matches.length > 0
    && text.trim() === state.answer.query;

  const outputShown =
    Boolean(notice) || answerShown || discoveryShown;

  return (
    <>
      {pileCap != null ? (
      <IconFloor
        sources={sources}
        cells={cells}
        sheet={sheet}
        apiRef={floor}
        onReady={onFloorReady}
        onMatchOpen={onMatchOpen}
        openTrackId={detail?.trackId ?? null}
        onSeat={onSeat}
      />
      ) : null}

      {detail ? (
        <AppDetail
          detail={detail}
          onFlightEnd={endFlight}
          onBack={closeDetail}
        />
      ) : (
        <>
          <SearchPage>
            <main className="stage-layer">
              <div
                ref={bar}
                className="stage-bar"
              >
                <div
                  className="stage-head"
                  data-hidden={outputShown ? "true" : "false"}
                  aria-hidden={outputShown || undefined}
                  inert={outputShown || undefined}
                >
                  <h1>AppStore success stories.</h1>

                  <p className="stage-sub">
                    All top-chart level apps, one search away with Jev x 10k.
                  </p>

                  <LiveStats />
                </div>

                <SearchComposer
                  value={text}
                  onChange={onType}
                  onSubmit={submit}
                  onClear={() => {
                    reset();
                    setText("");
                    setDetail(null);
                    floor.current?.ghost(null);
                  }}
                  busy={busy}
                />

                <div className="indexed-line">
                  <StoreMark size={13} />
                  <span>
                    {indexed.toLocaleString()}
                    {" "}
                    apps indexed
                  </span>
                </div>

                {discoveryTier
                && matches.length > 0 ? (
                  <p
                    className="discovery-tier"
                    title={`Match scores: ${discoveryTier}`}
                  >
                    <span className="jev-mark">Jev-powered</span>

                    <span className="sr">
                      Match scores are {discoveryTier}.
                    </span>
                  </p>
                ) : null}
              </div>
            </main>
          </SearchPage>

          {notice ? (
            <NoticeSurface role="alert">
              <p>{notice.message}</p>

              {notice.retry ? (
                <button
                  type="button"
                  aria-label="Try again"
                  onClick={() => {
                    void run(notice.retry!);
                  }}
                >
                  ↻
                </button>
              ) : null}
            </NoticeSurface>
          ) : null}

          {state.phase === "done"
          && route === "factual"
          && state.answer.shape === "factual" ? (
            <OutputShell>
              <FactualCard
                query={state.answer.query}
                app={state.answer.app}
                tier={state.answer.tier}
                onOpen={(trackId) => {
                  void openById(trackId, null);
                }}
              />
            </OutputShell>
          ) : null}

          {state.phase === "done"
          && route === "comparative"
          && state.answer.shape === "comparative" ? (
            <OutputShell>
              <ComparativeList
                rows={state.answer.rows}
                tier={state.answer.tier}
              />
            </OutputShell>
          ) : null}
        </>
      )}

    </>
  );
}
