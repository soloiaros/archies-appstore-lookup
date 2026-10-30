"use client";

import { useState } from "react";

const ITEMS = [
  {
    q: "What is 10K?",
    a: "A lookup across ten App Store markets. Choose a market, describe an app, name one, or compare a few. The answer comes from the charts, and every field carries a provenance mark.",
  },
  {
    q: "What can I ask?",
    a: "A description such as “minimalist habit tracker” or “green owl icon.” A short name, or a question about rating or price, returns that app. Words such as vs, compare, faster, or growing return a list ordered by stored momentum.",
  },
  {
    q: "What do the marks mean?",
    a: "Verified is stored as Apple published it. Estimated is a number with a recorded method, such as US store spend from chart rank. Unavailable means the catalog does not have it, and the field stays blank.",
  },
  {
    q: "Where does the catalog come from?",
    a: "Top charts in the US, Canada, Brazil, the UK, Germany, France, Spain, Japan, South Korea, and India, refreshed weekly through Apple’s public feeds and Lookup API. Downloads and monthly users stay empty unless a method is stored with the number.",
  },
  {
    q: "What do I need for a search?",
    a: "Choose a market and enter a description in English, or an app name in its local script. The US is selected by default, and your last market choice is remembered on this device.",
  },
] as const;

function Chevron() {
  return (
    <span className="home-faq-chevron" aria-hidden>
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
      >
        <path
          d="M4 6.5L8 10.5L12 6.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export function HomeFaq() {
  const [open, setOpen] = useState<Record<number, boolean>>(
    {},
  );

  return (
    <section
      className="home-block"
      aria-labelledby="faq-title"
    >
      <h2
        id="faq-title"
        className="home-block-title"
      >
        FAQs
      </h2>

      <div className="home-faq">
        {ITEMS.map((item, index) => {
          const on = open[index] === true;

          return (
            <div
              key={item.q}
              className="home-faq-item"
              data-open={on ? "true" : "false"}
            >
              <button
                type="button"
                className="home-faq-head"
                aria-expanded={on}
                onClick={() => {
                  setOpen((current) => ({
                    ...current,
                    [index]: !current[index],
                  }));
                }}
              >
                <span>{item.q}</span>
                <Chevron />
              </button>

              <div className="home-faq-panel">
                <div className="home-faq-panel-inner">
                  <p>{item.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
