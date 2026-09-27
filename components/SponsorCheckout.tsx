"use client";

import { useState } from "react";

import { playButtonSound } from "@/lib/sounds";

import type { SlotView } from "@/lib/site/types";

type Draft = {
  name: string;

  url: string;

  blurb: string;

  logoUrl: string;

  color: string;
};

const EMPTY: Draft = {
  name: "",
  url: "",
  blurb: "",
  logoUrl: "",
  color: "#1a1a1c",
};

export function SponsorCheckout({
  slots,
  priceLabel,
  selected,
  paid,
  canceled,
}: {
  slots: SlotView[];

  priceLabel: string;

  selected: number | null;

  paid: boolean;

  canceled: boolean;
}) {
  const requested = slots.find((slot) => slot.id === selected) ?? null;

  const open = slots.filter((slot) => slot.status === "open");

  const chosen = requested?.status === "open"
    ? requested
    : requested
      ? null
      : open[0] ?? null;

  const [link, setLink] = useState("");

  const [draft, setDraft] = useState<Draft>(EMPTY);

  const [ready, setReady] = useState(false);

  const [message, setMessage] = useState<string | null>(
    paid
      ? "Payment received. The card goes up once Stripe confirms it."
      : canceled
        ? "Checkout stopped. The slot is open again."
        : null,
  );

  const [busy, setBusy] = useState<"read" | "pay" | null>(null);

  if (!chosen) {
    const blocked = requested && requested.status !== "open";

    return (
      <section className="board-block" id="take">
        <h2>Take a slot</h2>

        <p className="board-note">
          {blocked
            ? "That slot is not open."
            : "Every slot is taken."}
        </p>
      </section>
    );
  }

  const readSite = async () => {
    setBusy("read");

    setMessage(null);

    const response = await fetch("/api/sponsor/preview", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ url: link }),
    });

    const body = await response.json() as Draft & { error?: string };

    setBusy(null);

    if (!response.ok) {
      setMessage(body.error ?? "That page did not load.");
      return;
    }

    setDraft({
      name: body.name ?? "",
      url: body.url ?? link,
      blurb: body.blurb ?? "",
      logoUrl: body.logoUrl ?? "",
      color: body.color ?? "#1a1a1c",
    });

    setReady(true);
  };

  const pay = async () => {
    setBusy("pay");

    setMessage(null);

    const response = await fetch("/api/sponsor/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        slotId: chosen.id,
        name: draft.name,
        url: draft.url,
        blurb: draft.blurb,
        logoUrl: draft.logoUrl,
        color: draft.color,
      }),
    });

    const body = await response.json() as {
      url?: string;

      error?: string;
    };

    if (!response.ok || !body.url) {
      setBusy(null);
      setMessage(body.error ?? "Checkout did not start.");
      return;
    }

    window.location.href = body.url;
  };

  return (
    <section className="board-block" id="take">
      <div className="board-block-head">
        <h2>
          Take slot
          {" "}
          {String(chosen.id).padStart(2, "0")}
        </h2>

        <p>
          {priceLabel}
          {" "}
          / 30 days
        </p>
      </div>

      <label className="field">
        <span>Your link</span>

        <input
          value={link}
          inputMode="url"
          placeholder="https://"
          onChange={(event) => {
            setLink(event.target.value);
            setReady(false);
          }}
        />
      </label>

      <button
        type="button"
        className="ui-key"
        disabled={busy !== null || link.trim().length < 8}
        onClick={() => {
          playButtonSound();
          void readSite();
        }}
      >
        {busy === "read" ? "Reading…" : "Read the site"}
      </button>

      {ready ? (
        <div className="sponsor-fields">
          <label className="field">
            <span>Name</span>

            <input
              value={draft.name}
              maxLength={48}
              onChange={(event) => {
                setDraft({ ...draft, name: event.target.value });
              }}
            />
          </label>

          <label className="field">
            <span>One-liner</span>

            <input
              value={draft.blurb}
              maxLength={120}
              onChange={(event) => {
                setDraft({ ...draft, blurb: event.target.value });
              }}
            />
          </label>

          <label className="field">
            <span>Logo URL</span>

            <input
              value={draft.logoUrl}
              onChange={(event) => {
                setDraft({ ...draft, logoUrl: event.target.value });
              }}
            />
          </label>

          <label className="field field-color">
            <span>Colour</span>

            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(draft.color) ? draft.color : "#1a1a1c"}
              onChange={(event) => {
                setDraft({ ...draft, color: event.target.value });
              }}
            />
          </label>

          <button
            type="button"
            className="ui-key sponsor-pay"
            disabled={
              busy !== null
              || !draft.name.trim()
              || !draft.blurb.trim()
              || !draft.url.trim()
            }
            onClick={() => {
              playButtonSound();
              void pay();
            }}
          >
            {busy === "pay" ? "Starting checkout…" : `Pay ${priceLabel}`}
          </button>
        </div>
      ) : null}

      {message ? (
        <p className="board-note" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
