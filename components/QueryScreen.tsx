"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AppCard,
  originFromPick,
} from "@/components/AppCard";

import { ComparativeList } from "@/components/ComparativeList";

import { FactualCard } from "@/components/FactualCard";

import {
  IconFloor,
  type FloorApi,
} from "@/components/IconFloor";

import { SearchComposer } from "@/components/SearchComposer";

import { StoreMark } from "@/components/ui/StoreMark";

import type { MatchPick } from "@/components/floor/overlays";

import type { Sheet } from "@/components/floor/atlas";

import { useQuery } from "@/hooks/useQuery";

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

  const [card, setCard] = useState<ReturnType<
    typeof originFromPick
  > | null>(null);

  const shape =
    state.phase === "done"
      ? state.answer.shape
      : null;

  const route = useRoute(shape);

  const drawn = useMemo(
    () => pileIcons.slice(0, 500),
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

      setCard(null);
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

  const onMatchOpen = useCallback(
    (pick: MatchPick) => {
      setCard(originFromPick(pick));
    },
    [],
  );

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
      />

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
              setCard(null);
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
              onOpen={(origin) => {
                setCard(origin);
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

      {card ? (
        <AppCard
          origin={card}
          onClose={() => {
            setCard(null);
          }}
        />
      ) : null}
    </>
  );
}
