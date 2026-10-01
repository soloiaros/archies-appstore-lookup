import Link from "next/link";

import { SectionPage } from "@/components/DirectionalPage";

export default function TermsPage() {
  return (
    <SectionPage>
      <main className="shell board board-narrow">
        <header className="board-head">
          <div>
            <p className="board-kicker">Legal</p>
            <h1>Terms of service</h1>
            <p className="board-lede">
              Last updated 2 October 2026. The rules for using 10K.
            </p>
          </div>
          <Link
            className="ui-key"
            href="/privacy"
            transitionTypes={["section"]}
          >
            Privacy policy
          </Link>
        </header>

        <section className="board-block legal-copy" aria-labelledby="service">
          <h2 id="service">The service</h2>
          <p>
            10K is a research tool over public App Store chart and lookup data. Results are
            informational. Fields may be verified, estimated, or unavailable. We do not
            guarantee completeness, ranking accuracy, or fitness for any business decision.
          </p>
        </section>

        <section className="board-block legal-copy" aria-labelledby="accounts">
          <h2 id="accounts">Accounts and limits</h2>
          <p>
            You may use the site as a guest or sign in with Google or GitHub. We apply daily
            free search limits so the service stays available: guests get fewer searches per
            UTC day than signed-in users. Limits, availability, and features may change.
          </p>
          <p>
            You are responsible for activity under your account. Do not abuse the service,
            attempt to bypass limits, or disrupt the site for others.
          </p>
        </section>

        <section className="board-block legal-copy" aria-labelledby="data-use">
          <h2 id="data-use">Your data</h2>
          <p>
            We use sign-in identity and guest identifiers only to recognize you for those
            limits, as described in the Privacy policy. App Store catalog content comes from
            Apple’s public feeds and remains subject to Apple’s terms; we do not claim ownership
            of Apple’s data or trademarks.
          </p>
        </section>

        <section className="board-block legal-copy" aria-labelledby="disclaimer">
          <h2 id="disclaimer">Disclaimer</h2>
          <p>
            The service is provided “as is,” without warranties of any kind. To the fullest
            extent allowed by law, we are not liable for losses arising from use of 10K,
            reliance on search results, or downtime.
          </p>
        </section>

        <section className="board-block legal-copy" aria-labelledby="changes-terms">
          <h2 id="changes-terms">Changes</h2>
          <p>
            We may update these terms. The date at the top will change when we do. Continued
            use after an update means you accept the new terms. If you disagree, stop using
            the service.
          </p>
        </section>
      </main>
    </SectionPage>
  );
}
