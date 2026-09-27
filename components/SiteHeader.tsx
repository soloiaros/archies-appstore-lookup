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

const MENU = [...NAV, ...SIDE] as const;

function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();

  const home = pathname === "/";

  const [scrolled, setScrolled] = useState(false);

  const [pastHero, setPastHero] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);

  const instant = useRef(false);

  const headerRef = useRef<HTMLElement>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  const toggleRef = useRef<HTMLButtonElement>(null);

  function closeMenu(immediate: boolean) {
    instant.current = immediate;

    const menu = menuRef.current;

    if (menu && immediate) {
      menu.dataset.instant = "true";
      menu.dataset.open = "false";
    }

    setMenuOpen(false);
  }

  function toggleMenu() {
    playButtonSound();

    if (menuOpen) {
      closeMenu(false);
      return;
    }

    instant.current = false;
    setMenuOpen(true);
  }

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

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!pastHero) {
      return;
    }

    instant.current = false;
    setMenuOpen(false);
  }, [pastHero]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 721px)");

    const onChange = () => {
      if (!mq.matches) {
        return;
      }

      instant.current = true;
      setMenuOpen(false);
    };

    mq.addEventListener("change", onChange);

    return () => {
      mq.removeEventListener("change", onChange);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      instant.current = false;
      setMenuOpen(false);
      toggleRef.current?.focus();
    };

    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <>
      <header
        ref={headerRef}
        className="site-header"
        data-hidden={pastHero ? "true" : "false"}
        data-menu={menuOpen ? "open" : "closed"}
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
              onClick={() => {
                playButtonSound();
                closeMenu(true);
              }}
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

          <button
            ref={toggleRef}
            type="button"
            className="ui-key menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={toggleMenu}
          >
            <span className="menu-toggle-label">
              {menuOpen ? "Close" : "Menu"}
            </span>

            <span
              className="menu-toggle-chevron"
              aria-hidden
            >
              <svg
                viewBox="0 0 12 12"
                width="12"
                height="12"
              >
                <path
                  d="M2.2 4.4 6 8l3.8-3.6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        </div>
      </header>

      <div
        ref={menuRef}
        className="site-menu"
        data-open={menuOpen ? "true" : "false"}
        data-instant={instant.current ? "true" : "false"}
        inert={menuOpen ? undefined : true}
      >
        <div className="site-menu-sheet">
          <div className="site-menu-clip">
            <div
              className="site-menu-blur"
              aria-hidden
            >
              <span
                className="site-menu-frost"
                style={{
                  backdropFilter: "blur(32px)",
                  WebkitBackdropFilter: "blur(32px)",
                }}
              />
              <span
                className="site-menu-frost"
                style={{
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                }}
              />
              <span
                className="site-menu-frost"
                style={{
                  backdropFilter: "blur(6px)",
                  WebkitBackdropFilter: "blur(6px)",
                }}
              />
              <span className="site-menu-wash" />
            </div>

            <nav
              id="site-menu"
              className="page-rail site-menu-nav"
              aria-label="Site"
            >
              <ul>
                {MENU.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="site-menu-link"
                      aria-current={
                        isCurrent(pathname, item.href)
                          ? "page"
                          : undefined
                      }
                      transitionTypes={["section"]}
                      onClick={() => {
                        playButtonSound();
                        closeMenu(true);
                      }}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}

                <li>
                  <a
                    className="site-menu-link"
                    href={GITHUB_REPO}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      playButtonSound();
                      closeMenu(true);
                    }}
                  >
                    <span>GitHub</span>
                    <span className="sr">
                      (opens in a new tab)
                    </span>
                    <svg
                      className="site-menu-star"
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      aria-hidden
                    >
                      <path
                        d="M12 2.8l2.84 5.76 6.36.92-4.6 4.49 1.09 6.33L12 17.3l-5.69 3 1.09-6.33-4.6-4.49 6.36-.92z"
                        fill="currentColor"
                      />
                    </svg>
                  </a>
                </li>
              </ul>
            </nav>

            <div
              className="site-menu-tail"
              aria-hidden
            />
          </div>
        </div>

        <button
          type="button"
          className="site-menu-dismiss"
          aria-label="Close menu"
          tabIndex={-1}
          onClick={() => {
            playButtonSound();
            closeMenu(false);
          }}
        />
      </div>

      <PageBeacon />

      <div
        className="header-blur"
        data-on={scrolled && !pastHero && !menuOpen ? "true" : "false"}
        data-hidden={pastHero ? "true" : "false"}
        aria-hidden
      />
    </>
  );
}
