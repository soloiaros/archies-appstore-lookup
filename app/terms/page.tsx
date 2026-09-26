import type { Metadata } from "next";

import { SectionPage } from "@/components/DirectionalPage";

export const metadata: Metadata = {
  title: "Terms of Service - 10K",
  description: "Terms of Service for 10K AppStore Indexer.",
};

export default function TermsPage() {
  return (
    <SectionPage>
      <main className="shell legal-doc">
        <header className="legal-header">
          <h1 className="legal-title">Terms of Service</h1>

          <p className="legal-updated">Last updated: September 27, 2026</p>
        </header>

        <article className="legal-content">
          <section className="legal-section">
            <h2>1. Service Description</h2>

            <p>
              10K (&quot;the Service&quot;) is a natural-language search and market intelligence engine for Apple App Store applications. The Service indexes public chart metadata and computes derived momentum and financial estimate statistics (such as estimated revenue, downloads, and rank trajectories).
            </p>
          </section>

          <section className="legal-section">
            <h2>2. Subscriptions &amp; Paid Access</h2>

            <p>
              10K offers paid access tiers (&quot;Pro&quot;) that provide broader search result limits, enhanced filtering parameters, and access to detailed financial estimate statistics. Purchases and recurring subscriptions are processed by our Merchant of Record and authorized payment processors.
            </p>

            <p>
              By purchasing a subscription, you authorize recurring charges to your payment method for the agreed billing period until canceled.
            </p>
          </section>

          <section className="legal-section">
            <h2>3. Data Provenance &amp; Financial Disclaimers</h2>

            <p>
              Every data field delivered by the Service carries an explicit provenance tier (<code>verified</code>, <code>estimated</code>, or <code>unavailable</code>).
            </p>

            <p>
              Financial figures marked as <code>estimated</code> (such as monthly store spend or download counts) are mathematical estimations derived from public chart positioning, category velocity, and statistical modeling. They do not constitute official accounting statements of app publishers or Apple Inc., and are provided solely for market research and competitive analysis.
            </p>
          </section>

          <section className="legal-section">
            <h2>4. Acceptable Use</h2>

            <p>
              You agree to use the Service in compliance with all applicable laws. You may not attempt to circumvent API rate limits, reverse-engineer proprietary scoring systems, or perform automated mass extraction of data without written authorization.
            </p>
          </section>

          <section className="legal-section">
            <h2>5. Intellectual Property</h2>

            <p>
              App Store is a trademark of Apple Inc. All app names, trademarks, icons, and public metadata remain the property of their respective owners. The 10K search index, scoring engines, and interface belong exclusively to the operator.
            </p>
          </section>

          <section className="legal-section">
            <h2>6. Limitation of Liability</h2>

            <p>
              The Service is provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of any kind. Under no circumstances shall 10K be liable for indirect, incidental, or consequential damages arising from your reliance on indexed data or estimates.
            </p>
          </section>

          <section className="legal-section">
            <h2>7. Contact</h2>

            <p>
              If you have questions regarding these Terms, please contact support at support@10kapp.io.
            </p>
          </section>
        </article>
      </main>
    </SectionPage>
  );
}
