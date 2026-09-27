"use client";

import { useEffect, useState } from "react";

export function HereNow() {
  const [here, setHere] = useState<number | null>(null);

  useEffect(() => {
    let stop = false;

    const tick = async () => {
      const response = await fetch("/api/presence");

      if (!response.ok || stop) {
        return;
      }

      const body = await response.json() as { here?: number };

      if (typeof body.here === "number") {
        setHere(body.here);
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
    <p className="here-now">
      <span>
        {here === null ? "…" : here.toLocaleString("en-US")}
        {" "}
        here now
      </span>
    </p>
  );
}
