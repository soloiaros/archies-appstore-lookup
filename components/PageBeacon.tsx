"use client";

import { useEffect } from "react";

import { usePathname } from "next/navigation";

const recent = {
  path: "",
  at: 0,
};

export function PageBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    const now = Date.now();

    if (recent.path === pathname && now - recent.at < 1500) {
      return;
    }

    recent.path = pathname;

    recent.at = now;

    void fetch("/api/collect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: pathname,
        referrer: document.referrer,
      }),
    }).catch(() => null);
  }, [pathname]);

  useEffect(() => {
    const beat = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void fetch("/api/presence", { method: "POST" }).catch(() => null);
    };

    beat();

    const id = window.setInterval(beat, 20_000);

    document.addEventListener("visibilitychange", beat);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);

  return null;
}
