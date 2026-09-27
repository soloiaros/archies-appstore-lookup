import type { Metadata } from "next";

import Link from "next/link";

import { SponsorCheckout } from "@/components/SponsorCheckout";

import { SectionPage } from "@/components/DirectionalPage";

import { formatPrice, sponsorPriceCents } from "@/lib/site/price";

import { listSlots } from "@/lib/site/slots";

import { loadStats } from "@/lib/site/stats";

import type { SlotView } from "@/lib/site/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sponsor",
};

const until = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function count(value: number) {
  return value.toLocaleString("en-US");
}

function SlotRow({
  slot,
  priceLabel,
}: {
  slot: SlotView;

  priceLabel: string;
}) {
  const label = `Slot ${String(slot.id).padStart(2, "0")}`;

  if (slot.kind === "house" || (slot.status === "taken" && slot.name)) {
    return (
      <li className="slot-row">
        {slot.logoUrl ? (
          <img src={slot.logoUrl} alt="" width={56} height={56} />
        ) : (
          <span className="slot-mark" aria-hidden />
        )}

        <div>
          <p className="slot-id">{label}</p>

          <strong>{slot.name}</strong>

          {slot.blurb ? <p>{slot.blurb}</p> : null}

          <p className="slot-state">
            {slot.kind === "house"
              ? "featured"
              : slot.paidUntil
                ? `taken until ${until.format(slot.paidUntil)}`
                : "taken"}
          </p>
        </div>
      </li>
    );
  }

  if (slot.status === "held") {
    return (
      <li className="slot-row">
        <div>
          <p className="slot-id">{label}</p>

          <strong>held</strong>

          <p className="slot-state">someone is at checkout right now</p>
        </div>
      </li>
    );
  }

  return (
    <li>
      <Link
        className="slot-row slot-row-open"
        href={`/sponsor?slot=${slot.id}#take`}
      >
        <div>
          <p className="slot-id">
            {label}
            {" "}
            · open
          </p>

          <strong>
            {priceLabel}
            <span> / 30 days</span>
          </strong>

          <p className="slot-state">take this slot →</p>
        </div>
      </Link>
    </li>
  );
}

export default async function SponsorPage({
  searchParams,
}: {
  searchParams: Promise<{
    slot?: string;

    paid?: string;

    canceled?: string;
  }>;
}) {
  const params = await searchParams;

  const slots = await listSlots();

  const price = formatPrice(sponsorPriceCents());

  const report = await loadStats(30);

  const taken = slots.filter((slot) => slot.status !== "open").length;

  const left = slots.length - taken;

  const selected = Number(params.slot);

  return (
    <SectionPage>
      <main className="shell board">
        <header className="board-head">
          <div>
            <p className="board-kicker">Sponsor</p>

            <h1>Sponsor 10K.</h1>

            <p className="board-lede">
              Six slots, seen beside Search by people looking up apps.
              If your product belongs in that glance, this is where they see it.
            </p>
          </div>
        </header>

        <section className="metric-grid" aria-label="Placement">
          <div className="metric metric-copy">
            <strong>{count(report.visitors)}</strong>

            <p>visitors, last 30 days</p>
          </div>

          <div className="metric metric-copy">
            <strong>{count(report.pageviews)}</strong>

            <p>pageviews, last 30 days</p>
          </div>

          <div className="metric metric-copy">
            <strong>
              {taken}
              /
              {slots.length}
            </strong>

            <p>slots taken</p>
          </div>

          <div className="metric metric-copy">
            <strong>{left}</strong>

            <p>slots left</p>
          </div>
        </section>

        <section className="board-block price-block">
          <h2>
            {price}
            <span> / 30 days</span>
          </h2>

          <p>
            One price, any open slot. Each card keeps its place:
            three on the left of Search, three on the right.
            On a narrow screen they sit in two strips, under the header and along the bottom.
          </p>

          <a className="ui-key sponsor-pay" href="#take">
            Take a slot ·
            {" "}
            {price}
          </a>
        </section>

        <SponsorCheckout
          slots={slots}
          priceLabel={price}
          selected={Number.isInteger(selected) ? selected : null}
          paid={params.paid === "1"}
          canceled={params.canceled === "1"}
        />

        <section className="board-block">
          <div className="board-block-head">
            <h2>The slots</h2>

            <p>
              {taken}
              {" "}
              taken ·
              {" "}
              {left}
              {" "}
              open
            </p>
          </div>

          <ol className="slot-list">
            {slots.map((slot) => (
              <SlotRow
                key={slot.id}
                slot={slot}
                priceLabel={price}
              />
            ))}
          </ol>
        </section>

        <section className="board-block">
          <div className="board-block-head">
            <h2>How it works</h2>

            <p>about two minutes, end to end</p>
          </div>

          <ol className="steps">
            <li>
              <span>01</span>

              <div>
                <strong>paste your link</strong>

                <p>
                  We read your site and fill in your name, one-liner, logo, and brand colour.
                  Change anything you like.
                </p>
              </div>
            </li>

            <li>
              <span>02</span>

              <div>
                <strong>pay on Stripe</strong>

                <p>
                  One checkout, no account, no call, no contract.
                  Your slot is held while you pay. Back out and it is freed.
                </p>
              </div>
            </li>

            <li>
              <span>03</span>

              <div>
                <strong>you&apos;re live</strong>

                <p>
                  Your card goes up when payment clears and runs for 30 days from then.
                  It does not renew itself.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section className="board-block">
          <h2>The boring part</h2>

          <p>
            What you&apos;re buying is 30 days of placement, paid once.
            It is not a subscription and it does not renew.
            When it ends, it ends, and you can buy it again.
            The clock starts when your payment clears.
            There are six spots. The top-left one stays with Beau.
            Sponsorship never changes what a search returns.
          </p>
        </section>
      </main>
    </SectionPage>
  );
}
