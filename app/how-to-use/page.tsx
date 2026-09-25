import type { Metadata } from "next";

import { SectionPage } from "@/components/DirectionalPage";

import { Key } from "@/components/ui/Key";

export const metadata: Metadata = {
  title: "How to use",
};

export default function HowToUsePage() {
  return (
    <SectionPage>
      <main className="sheet">
        <h1>How to use</h1>

        <p className="sheet-lead">
          Open Search and type. The shape of the sentence picks
          the path.
        </p>

        <section>
          <h2>Factual</h2>

          <p>
            Use a short name, or a question that starts like
            “what” or “rating”. You get one app’s stored fields,
            each with a provenance tier.
          </p>
        </section>

        <section>
          <h2>Comparative</h2>

          <p>
            Use words like “vs”, “compare”, “faster”, or
            “growing”. You get a list sorted by stored momentum.
            Momentum stays unavailable until two daily rating
            snapshots exist.
          </p>
        </section>

        <section>
          <h2>Discovery</h2>

          <p>
            Use anything else, such as “minimalist habit tracker”
            or “green owl icon”. Matching icons come up with a
            score. Apps under the threshold stay off the pile.
          </p>
        </section>

        <section>
          <h2>Provenance</h2>

          <p>
            Every shown field is verified, estimated, or
            unavailable. A missing number is left empty.
          </p>
        </section>

        <div className="home-actions">
          <Key href="/search">
            Search
          </Key>
        </div>
      </main>
    </SectionPage>
  );
}
