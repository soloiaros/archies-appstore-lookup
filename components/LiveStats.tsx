"use client";

import { useEffect, useState } from "react";

export function LiveStats() {
  const [visitors, setVisitors] = useState<number | null>(null);

  const [here, setHere] = useState<number | null>(null);

  useEffect(() => {
    let stop = false;

    const tick = async () => {
      const response = await fetch("/api/presence").catch(() => null);

      if (!response?.ok || stop) {
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
    <p className="live-stats" aria-live="polite">
      <span>
        {visitors === null
          ? "…"
          : visitors.toLocaleString("en-US")}
        {" "}
        visitors so far
      </span>

      <span className="live-stats-rule" aria-hidden />

      <span className="here-dot" aria-hidden />

      <span>
        {here === null ? "…" : here.toLocaleString("en-US")}
        {" "}
        here now
      </span>
    </p>
  );
}
