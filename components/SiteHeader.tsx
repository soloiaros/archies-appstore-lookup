"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";

import { usePathname } from "next/navigation";

import { PageBeacon } from "@/components/PageBeacon";

import { Key } from "@/components/ui/Key";

import { GITHUB_REPO } from "@/lib/links";

import { playButtonSound } from "@/lib/sounds";

const NAV = [
  {
    href: "/search",
    label: "Search",
  },
  {
    href: "/how-to-use",
    label: "How to use",
  },
] as const;

const SIDE = [
  {
    href: "/stats",
    label: "Stats",
  },
  {
    href: "/sponsor",
    label: "Sponsor",
  },
] as const;

function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();

  const home = pathname === "/";

  const [scrolled, setScrolled] = useState(false);

  const [pastHero, setPastHero] = useState(false);

  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = headerRef.current;

    if (!el) {
      return;
    }

    const apply = () => {
      document.documentElement.style.setProperty(
        "--header-h",
        `${el.getBoundingClientRect().height}px`,
      );
    };

    apply();

    const observer = new ResizeObserver(apply);

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;

      setScrolled(y > 2);

      if (!home) {
        setPastHero(false);
        return;
      }

      const hero = document.querySelector(".home-hero");

      if (!hero) {
        setPastHero(false);
        return;
      }

      setPastHero(hero.getBoundingClientRect().bottom <= 0);
    };

    onScroll();

    window.addEventListener("scroll", onScroll, {
      passive: true,
    });

    document.addEventListener("scroll", onScroll, {
      passive: true,
      capture: true,
    });

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("scroll", onScroll, {
        capture: true,
      });
    };
  }, [home]);

  return (
    <>
      <header
        ref={headerRef}
        className="site-header"
        data-hidden={pastHero ? "true" : "false"}
        style={{ viewTransitionName: "site-header" }}
      >
        <div className="page-rail site-header-bar">
          <div className="site-header-start">
            <Link
              href="/"
              className="brand"
              aria-label="10K home"
              aria-current={home ? "page" : undefined}
              transitionTypes={["section"]}
              onClick={() => playButtonSound()}
            >
              <img
                className="brand-logo"
                src="/branding/logo-full.svg"
                alt="10K"
              />
            </Link>

            <nav
              className="site-nav"
              aria-label="Primary"
            >
              {NAV.map((item) => (
                <Key
                  key={item.href}
                  href={item.href}
                  current={isCurrent(pathname, item.href)}
                  onClick={() => playButtonSound()}
                >
                  {item.label}
                </Key>
              ))}
            </nav>
          </div>

          <div className="site-header-end">
            <nav
              className="site-nav"
              aria-label="Site"
            >
              {SIDE.map((item) => (
                <Key
                  key={item.href}
                  href={item.href}
                  current={isCurrent(pathname, item.href)}
                  onClick={() => playButtonSound()}
                >
                  {item.label}
                </Key>
              ))}
            </nav>

            <a
              className="ui-key star-key"
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Star 10K on GitHub"
              title="Star on GitHub"
              onClick={() => playButtonSound()}
            >
              <svg
                viewBox="0 0 24 24"
                width="15"
                height="15"
                aria-hidden
              >
                <path
                  d="M12 2.8l2.84 5.76 6.36.92-4.6 4.49 1.09 6.33L12 17.3l-5.69 3 1.09-6.33-4.6-4.49 6.36-.92z"
                  fill="currentColor"
                />
              </svg>
            </a>
          </div>
        </div>
      </header>

      <PageBeacon />

      <div
        className="header-blur"
        data-on={scrolled && !pastHero ? "true" : "false"}
        data-hidden={pastHero ? "true" : "false"}
        aria-hidden
      />
    </>
  );
}
