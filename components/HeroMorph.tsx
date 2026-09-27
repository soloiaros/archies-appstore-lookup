"use client";

import { useEffect, useRef } from "react";

export function HeroMorph() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return;
    }

    let cancelled = false;

    fetch("/branding/inbetween-morphing.svg")
      .then((res) => res.text())
      .then((markup) => {
        if (cancelled || !host) {
          return;
        }

        host.innerHTML = markup;

        const svg = host.querySelector("svg");

        if (svg) {
          svg.setAttribute("class", "home-hero-anim");
          svg.setAttribute("aria-hidden", "true");
          svg.setAttribute("focusable", "false");
          svg.style.background = "transparent";
          svg.style.backgroundColor = "transparent";
        }
      })
      .catch(() => {
        if (cancelled || !host) {
          return;
        }

        const img = document.createElement("img");
        img.className = "home-hero-anim";
        img.src = "/branding/inbetween-morphing.svg";
        img.alt = "";
        img.decoding = "async";
        img.draggable = false;
        host.replaceChildren(img);
      });

    return () => {
      cancelled = true;
      host.replaceChildren();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className="home-hero-morph"
      aria-hidden
    />
  );
}
