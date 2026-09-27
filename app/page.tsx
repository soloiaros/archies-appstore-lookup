import { HomeFaq } from "@/components/HomeFaq";

import { HomeFooter } from "@/components/HomeFooter";

import { HeroMorph } from "@/components/HeroMorph";

import { HomeHeroActions } from "@/components/HomeHeroActions";

import { SectionPage } from "@/components/DirectionalPage";

import { VendingMachineScene } from "@/components/VendingMachineScene";

import { pileScene } from "@/lib/catalog/pile";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    n: "1",
    title: "Open Search",
    body: "Type in the field and press return. Press / to focus it, and Escape to clear it.",
  },
  {
    n: "2",
    title: "Get the apps",
    body: "10K shows all apps that matched your description.",
  },
  {
    n: "3",
    title: "Look into it",
    body: "Click an app. The indexer keeps relevant scores on app's revenue estimate and other features. Find what your competitors excel at.",
  },
] as const;

function indexedCount() {
  try {
    return pileScene(1).indexed;
  } catch {
    return 0;
  }
}

export default function HomePage() {
  const indexed = indexedCount();

  return (
    <SectionPage>
      <main className="home">
        <section className="home-hero" aria-label="10K">
          <div className="page-rail home-hero-inner">
            <HeroMorph />

            {indexed > 0 ? (
              <p className="home-hero-badge">
                <span>
                  {indexed.toLocaleString("en-US")}
                </span>
                <span className="home-hero-badge-dim">
                  apps indexed
                </span>
              </p>
            ) : null}

            <h1 className="home-hero-title">
              Jev-powered AppStore indexing for devs.
            </h1>

            <p className="home-hero-lede">
              Describe an app, get all matching AppStore listings in seconds,
              with stats on revenue and distinctive features.
            </p>

            <HomeHeroActions />
          </div>
        </section>

        <div className="page-rail home-rest">

          <section
            className="home-block"
            aria-labelledby="how-to-use-title"
          >
            <div className="home-howto-head">
              <h2
                id="how-to-use-title"
                className="home-howto-title"
              >
                Ask in plain language.
                <br />
                <span className="home-howto-dim">
                  The charts answer back.
                </span>
              </h2>

              <p className="home-howto-lede">
                Open Search and type what you want. The
                index is the US App Store charts, and a
                sentence is enough.
              </p>
            </div>

            <ol className="home-howto-steps">
              {STEPS.map((step) => (
                <li
                  key={step.n}
                  className="home-howto-step"
                >
                  <div className="home-howto-meta">
                    <span
                      className="home-howto-num"
                      aria-hidden
                    >
                      {step.n}
                    </span>

                    <h3>{step.title}</h3>
                  </div>

                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <HomeFaq />
        </div>

        <footer className="home-machine" aria-label="Site footer">
          <VendingMachineScene />
          <HomeFooter />
        </footer>
      </main>
    </SectionPage>
  );
}
