"use client";

import {
  FormEvent,
  useState,
} from "react";

import { ComparativeList } from "@/components/ComparativeList";

import { DiscoveryList } from "@/components/DiscoveryList";

import { FactualCard } from "@/components/FactualCard";

import { IconPile } from "@/components/IconPile";

import type { PileIcon } from "@/lib/catalog/pile";

import { useQuery } from "@/hooks/useQuery";

import { useRoute } from "@/hooks/useRoute";

export function QueryScreen({
  icons,
  indexed,
}: {
  icons: PileIcon[];

  indexed: number;
}) {
  const [text, setText] = useState("");

  const { state, run } = useQuery();

  const shape =
    state.phase === "done"
      ? state.answer.shape
      : null;

  const route = useRoute(shape);

  const showing =
    state.phase === "done"
    && (
      route === "discovery"
      || route === "factual"
      || route === "comparative"
    );

  function onSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    void run(text);
  }

  return (
    <div className="scene">
      <p className="mark">App Store</p>

      <IconPile
        icons={icons}
        dim={showing}
      />

      <div className="stage">
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

        <form
          className="composer"
          data-busy={
            state.phase === "loading"
              ? "true"
              : "false"
          }
          onSubmit={onSubmit}
        >
          <label className="sr" htmlFor="query">
            Query
          </label>

          <input
            id="query"
            name="query"
            value={text}
            placeholder="Describe an app"
            onChange={(event) => {
              setText(event.target.value);
            }}
            autoComplete="off"
          />

          <button type="submit" aria-label="Search">
            ↑
          </button>
        </form>

        <p className="indexed">
          {indexed.toLocaleString()}
          {" "}
          apps indexed
        </p>

        {state.phase === "loading" ? (
          <p className="notice">Looking up.</p>
        ) : null}

        {state.phase === "error" ? (
          <p className="notice" role="alert">
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
      </div>
    </div>
  );
}
