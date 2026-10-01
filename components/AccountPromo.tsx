"use client";

import {
  useEffect,
  useState,
} from "react";

import { BorderBeam } from "border-beam";

import {
  signIn,
  useSession,
} from "@/lib/auth-client";

import {
  GUEST_DAILY_LIMIT,
  USER_DAILY_LIMIT,
} from "@/lib/quota";

import { playButtonSound } from "@/lib/sounds";

const STORAGE_KEY = "10k-account-promo-v1";

type Props = {
  /** True once the guest has completed a search this session. */
  armed: boolean;
};

export function AccountPromo({ armed }: Props) {
  const { data: session } = useSession();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [beam, setBeam] = useState(false);

  useEffect(() => {
    setReady(true);
    setBeam(true);
  }, []);

  useEffect(() => {
    if (!ready || !armed || session?.user) {
      return;
    }

    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") {
        return;
      }
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // private mode — still show once this session
    }

    setOpen(true);
  }, [armed, ready, session?.user]);

  useEffect(() => {
    if (session?.user) {
      setOpen(false);
    }
  }, [session?.user]);

  if (!open) {
    return null;
  }

  const body = (
    <div
      className="account-promo-card"
      role="dialog"
      aria-labelledby="account-promo-title"
      aria-describedby="account-promo-body"
    >
      <div className="account-promo-top">
        <p
          id="account-promo-title"
          className="account-promo-kicker"
        >
          More with an account
        </p>
        <button
          type="button"
          className="account-promo-close"
          aria-label="Dismiss"
          onClick={() => {
            playButtonSound();
            setOpen(false);
          }}
        >
          ×
        </button>
      </div>

      <p
        id="account-promo-body"
        className="account-promo-copy"
      >
        Sign in with GitHub and get {USER_DAILY_LIMIT} free queries a day
        ({GUEST_DAILY_LIMIT} without an account), plus the ability to use your
        own Jev key for unlimited free queries (coming soon).
      </p>

      <button
        type="button"
        className="ui-key ui-key-solid account-promo-cta"
        onClick={() => {
          playButtonSound();
          void signIn.social({
            provider: "github",
            callbackURL: "/search",
          });
        }}
      >
        Sign in with GitHub
      </button>
    </div>
  );

  return (
    <div className="account-promo rise">
      {beam ? (
        <BorderBeam
          size="pulse-inner"
          colorVariant="mono"
          theme="dark"
          active
          strength={0.38}
          duration={3.2}
          brightness={1.15}
          borderRadius={16}
          className="account-promo-beam"
        >
          {body}
        </BorderBeam>
      ) : (
        <div className="account-promo-beam">
          {body}
        </div>
      )}
    </div>
  );
}
