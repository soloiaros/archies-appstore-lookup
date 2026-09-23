"use client";

import {
  useCallback,
  useState,
} from "react";

import type { QueryAnswer } from "@/lib/types";

export type QueryState =
  | {
      phase: "idle";
    }
  | {
      phase: "loading";

      query: string;
    }
  | {
      phase: "done";

      answer: QueryAnswer;
    }
  | {
      phase: "error";

      query: string;

      message: string;
    };

export function useQuery() {
  const [state, setState] = useState<QueryState>({
    phase: "idle",
  });

  const run = useCallback(
    async (raw: string) => {
      const query = raw.trim();

      if (query.length < 2) {
        setState({
          phase: "error",
          query,
          message: "Type at least 2 characters.",
        });

        return;
      }

      setState({
        phase: "loading",
        query,
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
            }),
          },
        );

        const data: unknown = await response.json();

        if (!response.ok) {
          const message =
            isErrorBody(data)
              ? data.error
              : "Query failed.";

          setState({
            phase: "error",
            query,
            message,
          });

          return;
        }

        if (!isAnswer(data)) {
          setState({
            phase: "error",
            query,
            message: "Query failed.",
          });

          return;
        }

        setState({
          phase: "done",
          answer: data,
        });
      } catch {
        setState({
          phase: "error",
          query,
          message: "Query failed.",
        });
      }
    },
    [],
  );

  return {
    state,
    run,
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
