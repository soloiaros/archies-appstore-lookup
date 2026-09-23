"use client";

import {
  FormEvent,
  useState,
} from "react";

import { ComparativeList } from "@/components/ComparativeList";

import { DiscoveryList } from "@/components/DiscoveryList";

import { FactualCard } from "@/components/FactualCard";

import { useQuery } from "@/hooks/useQuery";

import { useRoute } from "@/hooks/useRoute";

export function QueryScreen() {
  const [text, setText] = useState("");

  const { state, run } = useQuery();

  const shape =
    state.phase === "done"
      ? state.answer.shape
      : null;

  const route = useRoute(shape);

  function onSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    void run(text);
  }

  return (
    <section>
      <form onSubmit={onSubmit}>
        <label htmlFor="query">
          Query
        </label>

        <input
          id="query"
          name="query"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
          autoComplete="off"
        />

        <button type="submit">
          Search
        </button>
      </form>

      {state.phase === "loading" ? (
        <p>Looking up.</p>
      ) : null}

      {state.phase === "error" ? (
        <p role="alert">
          {state.message}
        </p>
      ) : null}

      {state.phase === "done"
      && route === "factual"
      && state.answer.shape === "factual" ? (
        <FactualCard
          query={state.answer.query}
          app={state.answer.app}
          tier={state.answer.tier}
        />
      ) : null}

      {state.phase === "done"
      && route === "comparative"
      && state.answer.shape === "comparative" ? (
        <ComparativeList
          rows={state.answer.rows}
          tier={state.answer.tier}
        />
      ) : null}

      {state.phase === "done"
      && route === "discovery"
      && state.answer.shape === "discovery" ? (
        <DiscoveryList
          hits={state.answer.hits}
          tier={state.answer.tier}
          scoring={state.answer.scoring}
          scoringNote={state.answer.scoringNote}
          finalistCount={state.answer.finalistCount}
        />
      ) : null}
    </section>
  );
}
