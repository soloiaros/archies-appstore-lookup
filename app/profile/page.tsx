"use client";

import Link from "next/link";

import { useSession } from "@/lib/auth-client";

export default function ProfilePage() {
  const { data: session, isPending } = useSession();
  const user = session?.user;

  return (
    <main className="shell profile-page">
      <div className="profile-card">
        <p className="profile-kicker">Account</p>
        <h1>Profile</h1>

        {isPending ? (
          <p className="profile-copy">Loading…</p>
        ) : user ? (
          <>
            <div className="profile-row">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt=""
                  width={48}
                  height={48}
                  className="profile-avatar"
                />
              ) : (
                <span className="profile-avatar-fallback" aria-hidden>
                  {(user.name || user.email || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
              <div>
                <p className="profile-name">{user.name || "Signed in"}</p>
                <p className="profile-copy">{user.email}</p>
              </div>
            </div>
            <p className="profile-copy">
              Signed-in accounts get 20 free searches per UTC day. Guests get 5.
            </p>
          </>
        ) : (
          <>
            <p className="profile-copy">
              You are not signed in. Use the account control in the header to continue with Google or GitHub.
            </p>
            <Link href="/" className="ui-key ui-key-solid">
              Back home
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
