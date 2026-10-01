"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import Link from "next/link";

import {
  signIn,
  signOut,
  useSession,
} from "@/lib/auth-client";

import {
  GUEST_DAILY_LIMIT,
  USER_DAILY_LIMIT,
  type QuotaSnapshot,
} from "@/lib/quota";

import { playButtonSound } from "@/lib/sounds";

type Props = {
  /** Desktop header control vs items inside the mobile menu sheet. */
  variant?: "header" | "menu";
};

function UserGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      aria-hidden
    >
      <path
        d="M12 12a4.2 4.2 0 1 0-4.2-4.2A4.2 4.2 0 0 0 12 12Zm0 2.1c-3.4 0-7.2 1.7-7.2 4.2v.9h14.4v-.9c0-2.5-3.8-4.2-7.2-4.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ProviderButtons({
  onPick,
}: {
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      className="auth-menu-item"
      onClick={() => {
        playButtonSound();
        onPick();
        void signIn.social({
          provider: "github",
          callbackURL: "/",
        });
      }}
    >
      Continue with GitHub
    </button>
  );
}

function AccountItems({
  name,
  remaining,
  limit,
  onDone,
}: {
  name: string;
  remaining: number;
  limit: number;
  onDone: () => void;
}) {
  return (
    <>
      <p className="auth-menu-label">{name}</p>
      <Link
        href="/profile"
        className="auth-menu-item"
        onClick={() => {
          playButtonSound();
          onDone();
        }}
      >
        Profile
      </Link>
      <span
        className="auth-menu-item"
        aria-disabled
        data-disabled="true"
      >
        Saved
      </span>
      <p className="auth-menu-meta">
        Free daily queries: {remaining}/{limit}
      </p>
      <button
        type="button"
        className="auth-menu-item"
        onClick={() => {
          playButtonSound();
          onDone();
          void signOut({
            fetchOptions: {
              onSuccess: () => {
                window.location.assign("/");
              },
            },
          });
        }}
      >
        Log out
      </button>
    </>
  );
}

export function AuthControl({
  variant = "header",
}: Props) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [quota, setQuota] = useState<QuotaSnapshot | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();
  // Until mounted, render the logged-out chrome so SSR and the first client
  // paint match (useSession is pending only on the client).
  const user = ready ? session?.user ?? null : null;

  useEffect(() => {
    setReady(true);
  }, []);

  const refreshQuota = useCallback(async () => {
    try {
      const response = await fetch("/api/quota", {
        cache: "no-store",
      });
      if (!response.ok) {
        return;
      }
      const body = (await response.json()) as QuotaSnapshot;
      setQuota(body);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void refreshQuota();
  }, [refreshQuota, user?.id]);

  useEffect(() => {
    if (!open || variant !== "header") {
      return;
    }

    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, variant]);

  const limit = user
    ? (quota?.limit ?? USER_DAILY_LIMIT)
    : (quota?.limit ?? GUEST_DAILY_LIMIT);
  const remaining = quota?.remaining ?? limit;
  const label = user?.name?.trim() || user?.email || "Account";
  const initial = (user?.name || user?.email || "?").slice(0, 1).toUpperCase();

  if (variant === "menu") {
    return (
      <div className="auth-menu-block">
        {user ? (
          <AccountItems
            name={label}
            remaining={remaining}
            limit={limit}
            onDone={() => undefined}
          />
        ) : (
          <>
            <p className="auth-menu-label">Sign in</p>
            <p className="auth-menu-meta">
              {GUEST_DAILY_LIMIT}/day free · {USER_DAILY_LIMIT}/day with an account
            </p>
            <ProviderButtons onPick={() => undefined} />
          </>
        )}
      </div>
    );
  }

  return (
    <div
      ref={root}
      className="auth-control"
      data-open={open ? "true" : "false"}
    >
      <button
        type="button"
        className="ui-key auth-key"
        aria-label={user ? "Account menu" : "Sign in"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          playButtonSound();
          void refreshQuota();
          setOpen((value) => !value);
        }}
      >
        {user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt=""
            className="auth-key-avatar"
            width={15}
            height={15}
          />
        ) : user ? (
          <span className="auth-key-initial" aria-hidden>
            {initial}
          </span>
        ) : (
          <UserGlyph />
        )}
      </button>

      <div
        id={menuId}
        className="auth-popover"
        role="menu"
        data-open={open ? "true" : "false"}
        hidden={!open}
      >
        <div className="auth-popover-inner">
          {user ? (
            <AccountItems
              name={label}
              remaining={remaining}
              limit={limit}
              onDone={() => setOpen(false)}
            />
          ) : (
            <>
              <p className="auth-menu-label">Sign in</p>
              <p className="auth-menu-meta">
                {GUEST_DAILY_LIMIT}/day free · {USER_DAILY_LIMIT}/day with an account
              </p>
              <ProviderButtons onPick={() => setOpen(false)} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
