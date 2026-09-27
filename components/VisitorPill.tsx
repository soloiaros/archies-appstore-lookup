"use client";

import { useEffect, useState } from "react";

import { usePathname } from "next/navigation";

const recent = {
  path: "",
  at: 0,
};

export function VisitorPill() {
  const pathname = usePathname();

  const [visitors, setVisitors] = useState<number | null>(null);

  const [here, setHere] = useState<number | null>(null);

  useEffect(() => {
    const now = Date.now();

    if (recent.path === pathname && now - recent.at < 1500) {
      return;
    }

    recent.path = pathname;

    recent.at = now;

    void fetch("/api/collect", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        path: pathname,
        referrer: document.referrer,
      }),
    });
  }, [pathname]);

  useEffect(() => {
    let stop = false;

    const tick = async () => {
      const response = await fetch("/api/presence", {
        method: "POST",
      });

      if (!response.ok || stop) {
        return;
      }

      const body = await response.json() as {
        here?: number;

        visitors?: number;
      };

      if (typeof body.here === "number") {
        setHere(body.here);
      }

      if (typeof body.visitors === "number") {
        setVisitors(body.visitors);
      }
    };

    void tick();

    const id = window.setInterval(() => {
      void tick();
    }, 20_000);

    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, []);

  return (
    <p className="visitor-pill" aria-live="polite">
      <span>
        {visitors === null
          ? "…"
          : `${visitors.toLocaleString("en-US")} visitors so far`}
      </span>

      <span className="here-dot" aria-hidden />

      <span>
        {here === null
          ? "…"
          : `${here.toLocaleString("en-US")} here now`}
      </span>
    </p>
  );
}
