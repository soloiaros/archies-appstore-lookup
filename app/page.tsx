import Link from "next/link";

import { SectionPage } from "@/components/DirectionalPage";

import { MetalKey } from "@/components/MetalKey";

export default function HomePage() {
  return (
    <SectionPage>
      <main className="sheet">
        <h1>Find an App Store app by what it does.</h1>

        <p className="sheet-lead">
          10K reads the US charts. A name, a comparison, or a
          description each take a different path, and every field
          shows whether it is verified, estimated, or unavailable.
        </p>

        <div className="home-actions">
          <MetalKey
            href="/search"
            primary
          >
            Search
          </MetalKey>

          <MetalKey href="/how-to-use">
            How to use
          </MetalKey>
        </div>

        <section>
          <h2>What a query returns</h2>

          <ul className="sheet-list">
            <li>
              <strong>Factual.</strong>
              {" "}
              A short name, or a question that starts like “what”
              or “rating”. One app’s stored fields. No language
              model.
            </li>

            <li>
              <strong>Comparative.</strong>
              {" "}
              Words like “vs”, “compare”, “faster”, or “growing”.
              A list sorted by stored momentum.
            </li>

            <li>
              <strong>Discovery.</strong>
              {" "}
              Anything else. Icons that clear a certainty
              threshold, with that score beside each one.
            </li>
          </ul>
        </section>

        <section>
          <h2>How a search runs</h2>

          <ol className="sheet-steps">
            <li>
              The query is classified before anything is retrieved.
            </li>

            <li>
              Discovery embeds the query locally and keeps a short
              list. It does not send the whole catalog to a model.
            </li>

            <li>
              A missing number stays unavailable. Downloads and
              use stay empty unless a cited source or a recorded
              method is attached.
            </li>
          </ol>
        </section>

        <section>
          <h2>Questions</h2>

          <h3>Where do the numbers come from?</h3>

          <p>
            Metadata, ratings, and chart ranks come from Apple’s
            public feeds and the iTunes Lookup API. US store spend
            per day, when present, is estimated from US
            top-grossing ranks.
          </p>

          <h3>What if a field is missing?</h3>

          <p>
            It is shown as unavailable. It is not filled with a
            guess.
          </p>

          <h3>Does every search call a model?</h3>

          <p>
            Factual and comparative answers do not. Discovery
            scores a short list. Without a key the page still
            loads, and nothing invents a percentage.
          </p>
        </section>

        <footer className="sheet-foot">
          <p className="sheet-brand">10K</p>

          <p>Find an app by what it does.</p>

          <nav aria-label="Footer">
            <Link
              href="/search"
              className="text-link"
              transitionTypes={["section"]}
            >
              Search
            </Link>

            <Link
              href="/how-to-use"
              className="text-link"
              transitionTypes={["section"]}
            >
              How to use
            </Link>

            <Link
              href="/studio"
              className="text-link"
              transitionTypes={["section"]}
            >
              Studio
            </Link>
          </nav>
        </footer>
      </main>
    </SectionPage>
  );
}
