import Link from "next/link";

import { SectionPage } from "@/components/DirectionalPage";

export default function PrivacyPage() {
  return (
    <SectionPage>
      <main className="shell board board-narrow">
        <header className="board-head">
          <div>
            <p className="board-kicker">Legal</p>
            <h1>Privacy policy</h1>
            <p className="board-lede">
              Last updated 2 October 2026. Plain language for how 10K handles account data.
            </p>
          </div>
          <Link
            className="ui-key"
            href="/terms"
            transitionTypes={["section"]}
          >
            Terms of service
          </Link>
        </header>

        <section className="board-block legal-copy" aria-labelledby="what-we-collect">
          <h2 id="what-we-collect">What we collect</h2>
          <p>
            If you sign in with Google or GitHub, we receive the identity details those
            providers share for OAuth sign-in—typically your name, email address, and
            profile image URL—plus the provider account id needed to keep your session.
          </p>
          <p>
            If you use the site without signing in, we may store a random visitor id in a
            cookie and your network address solely so we can count free searches for the day.
          </p>
        </section>

        <section className="board-block legal-copy" aria-labelledby="why">
          <h2 id="why">Why we use it</h2>
          <p>
            We use this information only to identify you (or your guest browser) so we can
            apply daily search limits: fewer searches for guests, more for signed-in accounts.
            We do not sell personal data, build advertising profiles, or use your identity for
            marketing.
          </p>
        </section>

        <section className="board-block legal-copy" aria-labelledby="storage">
          <h2 id="storage">Where it lives</h2>
          <p>
            Account and session records, and the daily search counters tied to them, are stored
            in our application database (including Cloudflare infrastructure when the site is
            hosted there). Session cookies stay in your browser so you remain signed in.
          </p>
        </section>

        <section className="board-block legal-copy" aria-labelledby="providers">
          <h2 id="providers">Sign-in providers</h2>
          <p>
            Google and GitHub authenticate you on their own sites. Their privacy policies apply
            to what they collect during that step. We only keep what we need afterward to
            recognize your account and enforce limits.
          </p>
        </section>

        <section className="board-block legal-copy" aria-labelledby="retention">
          <h2 id="retention">Retention and control</h2>
          <p>
            We keep account records while your account exists and keep daily counters for the
            current UTC day window used for limits. You can sign out at any time. To delete an
            account or ask a privacy question, contact the operator via the channels listed on
            the Support page.
          </p>
        </section>

        <section className="board-block legal-copy" aria-labelledby="changes">
          <h2 id="changes">Changes</h2>
          <p>
            If this policy changes in a material way, we will update the date above. Continued
            use of 10K after a change means you accept the updated policy.
          </p>
        </section>
      </main>
    </SectionPage>
  );
}
