import type { Metadata } from "next";

import { SectionPage } from "@/components/DirectionalPage";

export const metadata: Metadata = {
  title: "How to use",
};

const STEPS = [
  {
    title: "Search",
    body: "Open Search and type in the field. Return runs the query. Press / to focus the field, and Escape to clear it.",
  },
  {
    title: "Describe an app",
    body: "Say what it does, or what the icon looks like. Icons scored at 30% or higher stay, with that percentage beside each one.",
  },
  {
    title: "Name one app",
    body: "A short name, or a question about rating or price, returns that app and its stored fields.",
  },
  {
    title: "Compare",
    body: "Words such as vs, compare, faster, or growing return a list ordered by stored momentum. Without enough history, momentum stays unavailable.",
  },
  {
    title: "Read the mark",
    body: "Every field is verified, estimated, or unavailable. A missing number is shown as unavailable, not filled with a guess.",
  },
  {
    title: "Open a match",
    body: "Click an icon to open the app. The count of indexed apps sits under the search field.",
  },
] as const;

export default function HowToUsePage() {
  return (
    <SectionPage>
      <main className="shell guide">
        <h1 className="guide-title">
          Describe an app, name one, or compare a few.
        </h1>

        <div className="guide-grid">
          {STEPS.map((step) => (
            <section
              key={step.title}
              className="guide-card"
            >
              <h2>{step.title}</h2>

              <p>{step.body}</p>
            </section>
          ))}
        </div>

        <section className="guide-close">
          <h2>A blank field stays blank.</h2>

          <p>
            The index is the US App Store charts, from
            Apple&apos;s public feeds. Downloads and
            monthly users stay empty unless a method is
            stored with the number. US store spend, when
            shown, is an estimate from chart rank and is
            marked estimated.
          </p>
        </section>
      </main>
    </SectionPage>
  );
}
