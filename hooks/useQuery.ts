"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import type { QueryAnswer } from "@/lib/types";
import { DEFAULT_MARKET, type MarketCode } from "@/lib/markets";

export type QueryState =
  | {
      phase: "idle";
    }
  | {
      phase: "loading";

      query: string;
      market: MarketCode;
    }
  | {
      phase: "done";

      answer: QueryAnswer;
      market: MarketCode;
    }
  | {
      phase: "error";

      query: string;
      market: MarketCode;

      message: string;
    };

export function useQuery() {
  const [state, setState] = useState<QueryState>({
    phase: "idle",
  });
  const active = useRef<AbortController | null>(null);

  useEffect(() => () => active.current?.abort(), []);

  const reset = useCallback(() => {
    active.current?.abort();
    setState({ phase: "idle" });
  }, []);

  const run = useCallback(
    async (raw: string, market: MarketCode = DEFAULT_MARKET) => {
      active.current?.abort();
      const controller = new AbortController();
      active.current = controller;
      const query = raw.trim();

      if (query.length < 2) {
        setState({
          phase: "error",
          query,
          market,
          message: "Type at least 2 characters.",
        });

        return;
      }

      setState({
        phase: "loading",
        query,
        market,
      });

      try {
        const response = await fetch(
          "/api/query",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              query,
              market,
            }),
            signal: controller.signal,
          },
        );

        const data: unknown = await response.json();
        if (controller.signal.aborted) return;

        if (!response.ok) {
          const message =
            isErrorBody(data)
              ? data.error
              : "Query failed.";

          setState({
            phase: "error",
            query,
            market,
            message,
          });

          return;
        }

        if (!isAnswer(data)) {
          setState({
            phase: "error",
            query,
            market,
            message: "Query failed.",
          });

          return;
        }

        setState({
          phase: "done",
          answer: data,
          market,
        });

        window.dispatchEvent(new Event("10k-quota"));
      } catch {
        if (controller.signal.aborted) return;
        setState({
          phase: "error",
          query,
          market,
          message: "Query failed.",
        });
      }
    },
    [],
  );

  return {
    state,
    run,
    reset,
  };
}

function isErrorBody(
  value: unknown,
): value is { error: string } {
  if (
    typeof value !== "object"
    || value === null
    || !("error" in value)
  ) {
    return false;
  }

  return typeof value.error === "string";
}

function isAnswer(
  value: unknown,
): value is QueryAnswer {
  if (
    typeof value !== "object"
    || value === null
    || !("shape" in value)
  ) {
    return false;
  }

  const shape = value.shape;

  return (
    shape === "factual"
    || shape === "discovery"
    || shape === "comparative"
  );
}
