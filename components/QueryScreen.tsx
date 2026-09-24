"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  ViewTransition,
} from "react";

import { addTransitionType } from "react";

import {
  AppDetail,
  IconMorph,
  originFromPick,
} from "@/components/AppCard";

import { ComparativeList } from "@/components/ComparativeList";

import { FactualCard } from "@/components/FactualCard";

import {
  IconFloor,
  type FloorApi,
  type Seat,
} from "@/components/IconFloor";

import { ProvenanceMark } from "@/components/ProvenanceMark";

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

  const [lift, setLift] = useState<ReturnType<
    typeof originFromPick
  > | null>(null);

  const detailRef = useRef(detail);

  detailRef.current = detail;

  const ready = useRef(
    new Map<number, AppRecord>(),
  );

  const pending = useRef<AppRecord | null>(null);

  const [, startTransition] = useTransition();

  const wasOpen = useRef(false);

  const shape =
    state.phase === "done"
      ? state.answer.shape
      : null;

  const route = useRoute(shape);

  const drawn = useMemo(
    () => pileIcons.slice(0, Math.min(1200, pileIcons.length)),
    [pileIcons],
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
      || state.answer.scoring !== "scored"
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

      setLift(null);
      setDetail(null);
      pending.current = null;
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
        setLift(null);
        setDetail(next);
      });
    },
    [],
  );

  const closeDetail = useCallback(() => {
    startTransition(() => {
      addTransitionType("nav-back");
      setLift(null);
      setDetail(null);
    });
  }, []);

  const onSeat = useCallback(
    (seat: Seat) => {
      void (async () => {
        const next = await loadDetail(
          seat.trackId,
          seat.probability,
        );

        if (!next) {
          return;
        }

        floor.current?.ghost(seat.src);
        showDetail(next);
      })();
    },
    [loadDetail, showDetail],
  );

  const onMatchOpen = useCallback(
    (pick: MatchPick) => {
      void (async () => {
        const next = await loadDetail(
          pick.match.trackId,
          pick.match.probability,
        );

        if (!next) {
          return;
        }

        floor.current?.ghost(pick.match.src);
        pending.current = next;
        setLift(originFromPick(pick));
      })();
    },
    [loadDetail],
  );

  useLayoutEffect(() => {
    if (!lift || detail || !pending.current) {
      return;
    }

    const next = pending.current;

    pending.current = null;

    showDetail(next);
  }, [lift, detail, showDetail]);

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

  return (
    <>
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

      {detail ? (
        <ViewTransition
          enter={{
            "nav-forward": "nav-forward",
            "nav-back": "nav-back",
            default: "none",
          }}
          exit={{
            "nav-forward": "nav-forward",
            "nav-back": "nav-back",
            default: "none",
          }}
          default="none"
        >
          <AppDetail
            detail={detail}
            onFlightEnd={endFlight}
            onBack={closeDetail}
          />
        </ViewTransition>
      ) : (
      <ViewTransition
        enter={{
          "nav-forward": "nav-forward",
          "nav-back": "nav-back",
          default: "none",
        }}
        exit={{
          "nav-forward": "nav-forward",
          "nav-back": "nav-back",
          default: "none",
        }}
        default="none"
      >
      <main className="stage-layer">
        <div
          ref={bar}
          className="stage-bar"
        >
          <SearchComposer
            value={text}
            onChange={onType}
            onSubmit={submit}
            onClear={() => {
              reset();
              setText("");
              setLift(null);
              setDetail(null);
              pending.current = null;
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
            <p className="discovery-tier">
              <ProvenanceMark
                tier={discoveryTier}
              />
            </p>
          ) : null}
        </div>

        {notice ? (
          <div
            role="alert"
            className="rise notice-float"
          >
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
          </div>
        ) : null}

        {state.phase === "done"
        && route === "factual"
        && state.answer.shape === "factual" ? (
          <div className="answer-float">
            <FactualCard
              query={state.answer.query}
              app={state.answer.app}
              tier={state.answer.tier}
              lifted={false}
              onOpen={(origin) => {
                void (async () => {
                  const next = await loadDetail(
                    origin.trackId,
                    null,
                  );

                  if (!next) {
                    return;
                  }

                  showDetail(next);
                })();
              }}
            />
          </div>
        ) : null}

        {state.phase === "done"
        && route === "comparative"
        && state.answer.shape === "comparative" ? (
          <div className="answer-float">
            <ComparativeList
              rows={state.answer.rows}
              tier={state.answer.tier}
            />
          </div>
        ) : null}
      </main>
      </ViewTransition>
      )}

      {lift && !detail ? (
        <IconMorph trackId={lift.trackId}>
          <img
            className="icon-lift"
            src={lift.src}
            alt=""
            draggable={false}
            style={{
              left: lift.x,
              top: lift.y,
              width: lift.side,
              height: lift.side,
            }}
          />
        </IconMorph>
      ) : null}
    </>
  );
}
