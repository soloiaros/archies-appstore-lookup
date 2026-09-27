"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { useRouter } from "next/navigation";

import { LiveFace } from "@/components/SponsorCard";

import {
  SPONSOR_OPEN,
  type SponsorOpenDetail,
} from "@/lib/site/open";

import { playButtonSound } from "@/lib/sounds";

type Draft = {
  url: string;

  name: string;

  email: string;

  blurb: string;

  logoUrl: string;

  color: string;
};

type Done = {
  slotId: number;

  reference: string;

  holdUntil: number;

  email: string;
};

const EMPTY: Draft = {
  url: "",
  name: "",
  email: "",
  blurb: "",
  logoUrl: "",
  color: "#1a1a1c",
};

const BLURB_MAX = 90;

const holdLabel = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function withScheme(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return /^https?:\/\//i.test(trimmed)
    ? trimmed.replace(/^http:\/\//i, "https://")
    : `https://${trimmed}`;
}

async function shrink(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);

  const side = 128;

  const canvas = document.createElement("canvas");

  canvas.width = side;

  canvas.height = side;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("No canvas.");
  }

  const scale = Math.max(side / bitmap.width, side / bitmap.height);

  const width = bitmap.width * scale;

  const height = bitmap.height * scale;

  context.drawImage(
    bitmap,
    (side - width) / 2,
    (side - height) / 2,
    width,
    height,
  );

  bitmap.close();

  const webp = canvas.toDataURL("image/webp", 0.86);

  return webp.startsWith("data:image/webp")
    ? webp
    : canvas.toDataURL("image/png");
}

export function SponsorModal({
  priceLabel,
}: {
  priceLabel: string;
}) {
  const router = useRouter();

  const dialog = useRef<HTMLDialogElement>(null);

  const fileInput = useRef<HTMLInputElement>(null);

  const linkInput = useRef<HTMLInputElement>(null);

  const [slotId, setSlotId] = useState<number | null>(null);

  const [draft, setDraft] = useState<Draft>(EMPTY);

  const [reading, setReading] = useState(false);

  const [readNote, setReadNote] = useState("");

  const [sending, setSending] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [done, setDone] = useState<Done | null>(null);

  const lastRead = useRef("");

  const touched = useRef<Set<keyof Draft>>(new Set());

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<SponsorOpenDetail>).detail;

      setSlotId(detail?.slotId ?? null);

      setError(null);

      setDone(null);

      dialog.current?.showModal();

      window.requestAnimationFrame(() => {
        linkInput.current?.focus();
      });
    };

    window.addEventListener(SPONSOR_OPEN, onOpen);

    return () => {
      window.removeEventListener(SPONSOR_OPEN, onOpen);
    };
  }, []);

  const set = (key: keyof Draft, value: string) => {
    touched.current.add(key);

    setDraft((current) => ({ ...current, [key]: value }));
  };

  const readSite = useCallback(async (raw: string) => {
    const url = withScheme(raw);

    if (!url || url === lastRead.current) {
      return;
    }

    try {
      new URL(url);
    } catch {
      return;
    }

    lastRead.current = url;

    setReading(true);

    setReadNote("");

    const response = await fetch("/api/sponsor/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    }).catch(() => null);

    setReading(false);

    if (!response?.ok) {
      setReadNote("Couldn't read that page. Fill it in by hand.");
      return;
    }

    const found = await response.json() as {
      name?: string;

      blurb?: string;

      logoUrl?: string | null;

      color?: string | null;
    };

    setDraft((current) => ({
      ...current,
      url,
      name: touched.current.has("name") && current.name
        ? current.name
        : (found.name ?? "").slice(0, 40),
      blurb: touched.current.has("blurb") && current.blurb
        ? current.blurb
        : (found.blurb ?? "").slice(0, BLURB_MAX),
      logoUrl: touched.current.has("logoUrl") && current.logoUrl
        ? current.logoUrl
        : found.logoUrl ?? current.logoUrl,
      color: touched.current.has("color")
        ? current.color
        : found.color && found.color !== "#ffffff"
          ? found.color
          : current.color,
    }));

    setReadNote("Filled in from your site. Change anything.");
  }, []);

  useEffect(() => {
    const raw = draft.url.trim();

    if (!/^[^\s]+\.[a-z]{2,}(\/|$)/i.test(raw.replace(/^https?:\/\//i, ""))) {
      return;
    }

    const id = window.setTimeout(() => {
      void readSite(raw);
    }, 700);

    return () => {
      window.clearTimeout(id);
    };
  }, [draft.url, readSite]);

  const close = () => {
    dialog.current?.close();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    playButtonSound();

    setSending(true);

    setError(null);

    const response = await fetch("/api/sponsor/order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slotId,
        email: draft.email,
        name: draft.name,
        url: withScheme(draft.url),
        blurb: draft.blurb,
        logoUrl: draft.logoUrl,
        color: draft.color,
      }),
    }).catch(() => null);

    setSending(false);

    const body = response
      ? await response.json().catch(() => ({})) as Partial<Done> & { error?: string }
      : { error: "No connection. Try again." };

    if (!response?.ok || !body.slotId || !body.reference || !body.holdUntil) {
      setError(body.error ?? "That didn't go through. Try again.");
      return;
    }

    setDone({
      slotId: body.slotId,
      reference: body.reference,
      holdUntil: body.holdUntil,
      email: draft.email,
    });

    setDraft(EMPTY);

    touched.current.clear();

    lastRead.current = "";

    setReadNote("");

    router.refresh();
  };

  const label = slotId
    ? `Slot ${String(slotId).padStart(2, "0")}`
    : "Any open slot";

  return (
    <dialog
      ref={dialog}
      className="sponsor-modal"
      aria-labelledby="sponsor-modal-title"
      onClick={(event) => {
        if (event.target === dialog.current) {
          close();
        }
      }}
    >
      <div className="sponsor-modal-panel">
        <header className="sponsor-modal-head">
          <div>
            <p className="board-kicker">{done ? "Reserved" : label}</p>

            <h2 id="sponsor-modal-title">
              {done ? "Check your inbox" : "Put your product here"}
            </h2>

            {done ? null : (
              <p>
                {priceLabel}
                {" "}
                for 30 days, paid once. Your card sits beside Search on
                desktop and in the strips on phones.
              </p>
            )}
          </div>

          <button
            type="button"
            className="ui-key sponsor-modal-close"
            aria-label="Close"
            onClick={close}
          >
            ×
          </button>
        </header>

        {done ? (
          <div className="sponsor-done">
            <p>
              Slot
              {" "}
              {String(done.slotId).padStart(2, "0")}
              {" "}
              is held for you until
              {" "}
              <strong>{holdLabel.format(done.holdUntil)}</strong>
              . Wise payment details are on their way to
              {" "}
              <strong>{done.email}</strong>
              .
            </p>

            <ol className="sponsor-steps">
              <li>Open the email and pay by Wise.</li>

              <li>
                Put
                {" "}
                <code>{done.reference}</code>
                {" "}
                in the transfer note.
              </li>

              <li>Your card goes live when the payment arrives.</li>
            </ol>

            <button
              type="button"
              className="ui-key sponsor-submit"
              onClick={close}
            >
              Done
            </button>
          </div>
        ) : (
          <form className="sponsor-form" onSubmit={submit}>
            <div className="sponsor-fields">
              <label className="field">
                <span>Link</span>

                <input
                  ref={linkInput}
                  required
                  inputMode="url"
                  autoComplete="url"
                  spellCheck={false}
                  placeholder="https://yourapp.com"
                  value={draft.url}
                  onChange={(event) => set("url", event.target.value)}
                  onBlur={(event) => {
                    void readSite(event.target.value);
                  }}
                  onPaste={(event) => {
                    const pasted = event.clipboardData.getData("text");

                    window.setTimeout(() => {
                      void readSite(pasted);
                    }, 0);
                  }}
                />

                <em className="field-note" aria-live="polite">
                  {reading ? "Reading your site…" : readNote}
                </em>
              </label>

              <div className="field-pair">
                <label className="field">
                  <span>Name</span>

                  <input
                    required
                    maxLength={40}
                    placeholder="Acme"
                    value={draft.name}
                    onChange={(event) => set("name", event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Email</span>

                  <input
                    required
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={draft.email}
                    onChange={(event) => set("email", event.target.value)}
                  />
                </label>
              </div>

              <label className="field">
                <span>Description</span>

                <textarea
                  required
                  rows={2}
                  maxLength={BLURB_MAX}
                  placeholder="What you do, in one line"
                  value={draft.blurb}
                  onChange={(event) => set("blurb", event.target.value)}
                />

                <em className="field-count">
                  {draft.blurb.length}
                  /
                  {BLURB_MAX}
                </em>
              </label>

              <div className="field-pair">
                <div className="field">
                  <span>Picture</span>

                  <div className="picture-row">
                    <button
                      type="button"
                      className="picture-well"
                      aria-label="Upload a picture"
                      onClick={() => fileInput.current?.click()}
                    >
                      {draft.logoUrl ? (
                        <img src={draft.logoUrl} alt="" />
                      ) : (
                        <span aria-hidden>+</span>
                      )}
                    </button>

                    <button
                      type="button"
                      className="text-button"
                      onClick={() => fileInput.current?.click()}
                    >
                      {draft.logoUrl ? "Replace" : "Upload"}
                    </button>

                    {draft.logoUrl ? (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => set("logoUrl", "")}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>

                  <input
                    ref={fileInput}
                    hidden
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];

                      event.target.value = "";

                      if (!file) {
                        return;
                      }

                      try {
                        set("logoUrl", await shrink(file));
                      } catch {
                        setError("That picture didn't load. Try a PNG or JPEG.");
                      }
                    }}
                  />
                </div>

                <label className="field">
                  <span>Brand colour</span>

                  <span className="color-row">
                    <input
                      type="color"
                      value={draft.color}
                      onChange={(event) => set("color", event.target.value)}
                    />

                    <code>{draft.color}</code>
                  </span>
                </label>
              </div>
            </div>

            <aside className="sponsor-preview" aria-label="Preview">
              <span className="field-label">Preview</span>

              <LiveFace
                data={{
                  name: draft.name || "Your app",
                  blurb: draft.blurb || "A short line about what you do.",
                  logoUrl: draft.logoUrl || null,
                  color: draft.color,
                }}
                size="tile"
              />
            </aside>

            <footer className="sponsor-form-foot">
              {error ? (
                <p className="sponsor-error" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className="ui-key sponsor-submit"
                disabled={sending}
              >
                {sending ? "Reserving…" : `Reserve slot · ${priceLabel}`}
              </button>

              <p className="sponsor-fine">
                We email you Wise payment details. The slot is held for 72
                hours, and your card goes live when the payment arrives.
              </p>
            </footer>
          </form>
        )}
      </div>
    </dialog>
  );
}
