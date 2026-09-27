import Link from "next/link";

import { SectionPage } from "@/components/DirectionalPage";

const ASKS = [
  {
    title: "Describe a feature",
    body: "Say what it does, or what the icon looks like. Apps scored at 30% or higher stay, with the score beside each one.",
    example: "habit tracker with streaks",
  },
  {
    title: "Name one app",
    body: "A short name, or a question about rating or price, returns that app and its stored fields.",
    example: "Duolingo rating",
  },
  {
    title: "Compare",
    body: "Words such as vs, compare, faster, or growing return a list ordered by stored momentum.",
    example: "Notion vs Obsidian",
  },
] as const;

const READ = [
  {
    title: "Open a match",
    body: "Click an icon in the pile to open the app: revenue estimate, ratings, screenshots, and tags.",
  },
  {
    title: "Read the mark",
    body: "Every number is verified, estimated, or unavailable. Estimates carry the method that produced them.",
  },
] as const;

const KEYS = [
  {
    key: "/",
    label: "focus the field",
  },
  {
    key: "Return",
    label: "run the search",
  },
  {
    key: "Esc",
    label: "clear it",
  },
] as const;

export default function HowToUsePage() {
  return (
    <SectionPage>
      <main className="shell board board-narrow">
        <header className="board-head">
          <div>
            <p className="board-kicker">How to use</p>

            <h1>Ask in plain language.</h1>

            <p className="board-lede">
              Describe a feature, name an app, or compare a few. The index
              is the US App Store charts, and a sentence is enough.
            </p>
          </div>
        </header>

        <section
          className="board-block"
          aria-labelledby="ask-title"
        >
          <div className="board-block-head">
            <h2 id="ask-title">Three ways to ask</h2>

            <p>one field, one sentence</p>
          </div>

          <ol className="step-grid">
            {ASKS.map((ask, at) => (
              <li key={ask.title}>
                <span className="step-num">
                  {String(at + 1).padStart(2, "0")}
                </span>

                <strong>{ask.title}</strong>

                <p>{ask.body}</p>

                <code className="ask-example">{ask.example}</code>
              </li>
            ))}
          </ol>
        </section>

        <section
          className="board-block"
          aria-labelledby="read-title"
        >
          <div className="board-block-head">
            <h2 id="read-title">Reading the answer</h2>
          </div>

          <ul className="step-grid step-grid-two">
            {READ.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong>

                <p>{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="stat-row key-row" aria-label="Keyboard">
          {KEYS.map((item) => (
            <div className="stat" key={item.key}>
              <kbd className="key-cap">{item.key}</kbd>

              <span>{item.label}</span>
            </div>
          ))}
        </section>

        <section className="fine-print">
          <h2>A blank field stays blank.</h2>

          <p>
            The index comes from Apple&apos;s public feeds. Downloads and
            monthly users stay empty unless a method is stored with the
            number. US store spend, when shown, is an estimate from chart
            rank and is marked estimated.
          </p>

          <p>
            <Link className="ui-key sponsor-submit" href="/search" transitionTypes={["section"]}>
              Open Search
            </Link>
          </p>
        </section>
      </main>
    </SectionPage>
  );
}
