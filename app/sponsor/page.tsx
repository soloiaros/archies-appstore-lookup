import type { Metadata } from "next";

import { SectionPage } from "@/components/DirectionalPage";

import { SlotMap } from "@/components/SlotMap";

import { formatPrice, sponsorPriceCents } from "@/lib/site/price";

import { listSlots } from "@/lib/site/slots";

import { loadStats } from "@/lib/site/stats";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sponsor",
};

const STEPS = [
  {
    title: "Fill it out",
    body: "Paste your link. We fill in the name, line, picture, and colour from your site. Change anything.",
  },
  {
    title: "Get Wise details",
    body: "We hold your spot for 72 hours and email you Wise payment details with a reference.",
  },
  {
    title: "Pay, go live",
    body: "When the payment arrives, your card goes up and runs for 30 days. It doesn't renew.",
  },
] as const;

function count(value: number) {
  return value.toLocaleString("en-US");
}

export default async function SponsorPage() {
  const [slots, report] = await Promise.all([
    listSlots(),
    loadStats(30),
  ]);

  const price = formatPrice(sponsorPriceCents());

  const left = slots.filter((slot) => slot.status === "open").length;

  return (
    <SectionPage>
      <main className="shell board board-narrow">
        <header className="board-head">
          <div>
            <p className="board-kicker">Sponsor</p>

            <h1>Sponsor 10K.</h1>

            <p className="board-lede">
              Six spots beside Search, seen by developers sizing up the
              App Store. One flat price, no account, no call.
            </p>
          </div>

          <p className="price-chip">
            <strong>{price}</strong>

            <span>per 30 days</span>
          </p>
        </header>

        <section
          className="board-block"
          aria-labelledby="pick-title"
        >
          <div className="board-block-head">
            <h2 id="pick-title">Pick a spot</h2>

            <p>
              {left}
              {" "}
              open
            </p>
          </div>

          <SlotMap slots={slots} priceLabel={price} />
        </section>

        <section className="stat-row" aria-label="Reach">
          <div className="stat">
            <strong>{count(report.visitors)}</strong>

            <span>visitors, last 30 days</span>
          </div>

          <div className="stat">
            <strong>{count(report.pageviews)}</strong>

            <span>pageviews, last 30 days</span>
          </div>

          <div className="stat">
            <strong>
              {left}
              /
              {slots.length}
            </strong>

            <span>spots open</span>
          </div>
        </section>

        <section
          className="board-block"
          aria-labelledby="how-title"
        >
          <div className="board-block-head">
            <h2 id="how-title">How it works</h2>

            <p>about two minutes</p>
          </div>

          <ol className="step-grid">
            {STEPS.map((step, at) => (
              <li key={step.title}>
                <span className="step-num">
                  {String(at + 1).padStart(2, "0")}
                </span>

                <strong>{step.title}</strong>

                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="fine-print">
          <h2>The fine print</h2>

          <p>
            You buy 30 days of placement, paid once. It is not a
            subscription. The clock starts when your payment arrives. An
            unpaid hold ends after 72 hours and the spot opens again. The
            top-left spot stays with Beau. Sponsorship never changes what a
            search returns.
          </p>
        </section>
      </main>
    </SectionPage>
  );
}
