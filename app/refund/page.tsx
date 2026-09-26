import type { Metadata } from "next";

import { SectionPage } from "@/components/DirectionalPage";

export const metadata: Metadata = {
  title: "Refund Policy - 10K",
  description: "Refund and Cancellation Policy for 10K AppStore Indexer.",
};

export default function RefundPage() {
  return (
    <SectionPage>
      <main className="shell legal-doc">
        <header className="legal-header">
          <h1 className="legal-title">Refund &amp; Cancellation Policy</h1>

          <p className="legal-updated">Last updated: September 27, 2026</p>
        </header>

        <article className="legal-content">
          <section className="legal-section">
            <h2>1. Guarantee &amp; Overview</h2>

            <p>
              10K sells access to expanded App Store search results, deeper catalog filtering, and derived financial estimate statistics. We want our subscribers to be completely satisfied with our research tools.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. 14-Day Money-Back Guarantee</h2>

            <p>
              If you subscribe to 10K Pro and find that our search depth or financial estimate statistics do not fit your research workflow, you may request a 100% full refund within 14 calendar days of your initial purchase.
            </p>
          </section>

          <section className="legal-section">
            <h2>3. Subscription Cancellations</h2>

            <p>
              You may cancel your subscription at any time through your checkout receipt portal or by contacting support.
            </p>

            <p>
              Upon cancellation, your Pro tier access remains active through the end of your current paid billing period. No further recurring charges will occur.
            </p>
          </section>

          <section className="legal-section">
            <h2>4. Renewal Refund Requests</h2>

            <p>
              For automatic subscription renewals, refund requests submitted within 48 hours of the billing date will be honored, provided minimal API or search query activity occurred during the renewed period.
            </p>
          </section>

          <section className="legal-section">
            <h2>5. How to Request a Refund</h2>

            <p>
              To request a refund, please contact us at support@10kapp.io with your account email and purchase order ID, or use the refund request option in your payment processor billing portal. Refunds are credited back to your original payment method within 5 to 10 business days.
            </p>
          </section>
        </article>
      </main>
    </SectionPage>
  );
}
