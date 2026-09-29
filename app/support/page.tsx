import { SectionPage } from "@/components/DirectionalPage";

import {
  ARCHIE_X,
  GITHUB_REPO,
  POST_ON_THREADS,
  POST_ON_X,
} from "@/lib/links";

const WAYS = [
  {
    title: "Star it",
    body: "Star the repo on GitHub. It helps other people find 10K.",
    links: [
      {
        href: GITHUB_REPO,
        label: "Star on GitHub",
      },
    ],
  },
  {
    title: "Post about it",
    body: "On X, Threads, or anywhere else. Tag @archieauburn.",
    links: [
      {
        href: POST_ON_X,
        label: "Post on X",
      },
      {
        href: POST_ON_THREADS,
        label: "Post on Threads",
      },
    ],
  },
  {
    title: "Cover Jev",
    body: "A small donation pays for the model that scores each search. Message @archieauburn to send it.",
    links: [
      {
        href: ARCHIE_X,
        label: "Message @archieauburn",
      },
    ],
  },
] as const;

export default function SupportPage() {
  return (
    <SectionPage>
      <main className="shell board board-narrow">
        <header className="board-head">
          <div>
            <p className="board-kicker">Support</p>

            <h1>Keep Jev running.</h1>

            <p className="board-lede">
              Scoring each search costs money. Three ways to help.
            </p>
          </div>
        </header>

        <section
          className="board-block"
          aria-labelledby="ways-title"
        >
          <div className="board-block-head">
            <h2 id="ways-title">Ways to help</h2>

            <p>pick one</p>
          </div>

          <ol className="step-grid">
            {WAYS.map((way, at) => (
              <li key={way.title}>
                <span className="step-num">
                  {String(at + 1).padStart(2, "0")}
                </span>

                <strong>{way.title}</strong>

                <p>{way.body}</p>

                <div className="step-links">
                  {way.links.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.label}
                      <span className="sr">
                        (opens in a new tab)
                      </span>
                    </a>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="fine-print">
          <h2>The fine print</h2>

          <p>
            Any of the three is enough. Support never changes what a
            search returns.
          </p>
        </section>
      </main>
    </SectionPage>
  );
}
