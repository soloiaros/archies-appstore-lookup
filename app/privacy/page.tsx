import type { Metadata } from "next";

import { SectionPage } from "@/components/DirectionalPage";

export const metadata: Metadata = {
  title: "Privacy Policy - 10K",
  description: "Privacy Policy for 10K AppStore Indexer.",
};

export default function PrivacyPage() {
  return (
    <SectionPage>
      <main className="shell legal-doc">
        <header className="legal-header">
          <h1 className="legal-title">Privacy Policy</h1>

          <p className="legal-updated">Last updated: September 27, 2026</p>
        </header>

        <article className="legal-content">
          <section className="legal-section">
            <h2>1. Information We Collect</h2>

            <p>
              10K collects minimal personal information necessary to deliver search queries and manage subscription access:
            </p>

            <ul>
              <li>
                <strong>Account &amp; Contact Data:</strong> Email address provided during checkout or authentication.
              </li>
              <li>
                <strong>Usage &amp; Search Queries:</strong> Search strings and interaction logs used to return relevant App Store results and monitor engine performance.
              </li>
              <li>
                <strong>Payment Information:</strong> Payment transactions are handled directly by our Merchant of Record / payment processor. 10K never receives or stores your full credit card numbers or raw banking credentials.
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>2. How We Use Information</h2>

            <p>
              We use collected information strictly to:
            </p>

            <ul>
              <li>Process search queries and display app intelligence.</li>
              <li>Verify Pro tier access and manage billing status.</li>
              <li>Prevent unauthorized abuse, rate-limit violations, or system disruption.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>3. Third-Party Services</h2>

            <p>
              We interact with trusted third-party services to operate 10K:
            </p>

            <ul>
              <li>
                <strong>Apple iTunes Lookup API:</strong> Used to retrieve public App Store metadata. No personal user data is sent to Apple.
              </li>
              <li>
                <strong>Merchant of Record / Payment Processors:</strong> Used to securely manage payment processing, invoicing, and taxes.
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>4. Data Security &amp; Storage</h2>

            <p>
              We implement industry-standard security measures to safeguard account data and search session tokens. Data is retained only as long as necessary to fulfill service commitments or legal obligations.
            </p>
          </section>

          <section className="legal-section">
            <h2>5. Your Rights &amp; Data Deletion</h2>

            <p>
              You have the right to request access to your personal data or request account deletion at any time. To submit a request, contact support@10kapp.io.
            </p>
          </section>

          <section className="legal-section">
            <h2>6. Updates to Policy</h2>

            <p>
              We may periodically update this Privacy Policy. Material changes will be noted on this page with an updated revision date.
            </p>
          </section>
        </article>
      </main>
    </SectionPage>
  );
}
