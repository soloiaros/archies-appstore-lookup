import Link from "next/link";

import { SectionPage } from "@/components/DirectionalPage";

const ASKS = [
  {
    title: "Describe a feature",
    example: "habit tracker with streaks",
  },
  {
    title: "Name an app",
    example: "Duolingo rating",
  },
  {
    title: "Compare",
    example: "Notion vs Obsidian",
  },
] as const;

const PIPE = [
  {
    title: "Index",
    body: "US App Store charts from Apple's feeds, refreshed daily.",
  },
  {
    title: "Route",
    body: "Your query is sorted: one app, a comparison, or a feature.",
  },
  {
    title: "Retrieve",
    body: "Up to 120 candidates by meaning, icon look, tags, and name.",
  },
  {
    title: "Score",
    body: "Jev rates each one. 30% and up stays on the pile.",
  },
] as const;

const KEYS = [
  {
    key: "/",
    label: "focus",
  },
  {
    key: "Return",
    label: "search",
  },
  {
    key: "Esc",
    label: "clear",
  },
] as const;

export default function HowToUsePage() {
  return (
    <SectionPage>
      <main className="shell board board-narrow">
        <header className="board-head">
          <div>
            <p className="board-kicker">How to use</p>

            <h1>One field. Plain words.</h1>
          </div>

          <Link
            className="ui-key sponsor-submit"
            href="/search"
            transitionTypes={["section"]}
          >
            Open Search
          </Link>
        </header>

        <section
          className="board-block"
          aria-labelledby="ask-title"
        >
          <h2 id="ask-title">Ask</h2>

          <ul className="ask-list">
            {ASKS.map((ask) => (
              <li key={ask.title}>
                <span>{ask.title}</span>

                <code>{ask.example}</code>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="board-block"
          aria-labelledby="hood-title"
        >
          <h2 id="hood-title">Under the hood</h2>

          <ol className="pipe">
            {PIPE.map((step, at) => (
              <li key={step.title}>
                <span className="step-num">
                  {String(at + 1).padStart(2, "0")}
                </span>

                <strong>{step.title}</strong>

                <p>{step.body}</p>
              </li>
            ))}
          </ol>

          <p className="pipe-note">
            Revenue is estimated from top-grossing rank. Every number is
            marked verified, estimated, or unavailable, never guessed.
          </p>
        </section>

        <section className="stat-row key-row" aria-label="Keyboard">
          {KEYS.map((item) => (
            <div className="stat" key={item.key}>
              <kbd className="key-cap">{item.key}</kbd>

              <span>{item.label}</span>
            </div>
          ))}
        </section>
      </main>
    </SectionPage>
  );
}
