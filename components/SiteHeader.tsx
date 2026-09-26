"use client";

import Link from "next/link";

import { usePathname } from "next/navigation";

import { Key } from "@/components/ui/Key";

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
  {
    href: "/studio",
    label: "Studio",
  },
] as const;

const GITHUB =
  "https://github.com/soloiaros/archies-appstore-lookup";

function BrandMark() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      aria-hidden
      focusable="false"
    >
      <path
        d="M1.8 3.1h8.4M1.8 6h5.4M1.8 8.9h8.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12 2C6.477 2 2 6.486 2 12.021c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.866-.013-1.7-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.622.069-.609.069-.609 1.004.071 1.532 1.033 1.532 1.033.892 1.53 2.341 1.088 2.91.833.091-.647.35-1.088.636-1.339-2.22-.253-4.555-1.113-4.555-4.952 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.56 9.56 0 0 1 2.504.337c1.909-1.296 2.747-1.026 2.747-1.026.546 1.378.203 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.944.359.31.678.92.678 1.855 0 1.338-.012 2.417-.012 2.745 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.021C22 6.486 17.523 2 12 2Z"
      />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname();

  const home = pathname === "/";

  return (
    <header
      className="site-header"
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
          <span className="brand-plate" aria-hidden>
            <BrandMark />
          </span>

          <span className="brand-word">10K</span>
        </Link>

        <nav
          className="site-nav"
          aria-label="Primary"
        >
          {NAV.map((item) => {
            const current =
              pathname === item.href
              || pathname.startsWith(`${item.href}/`);

            return (
              <Key
                key={item.href}
                href={item.href}
                current={current}
                onClick={() => playButtonSound()}
              >
                {item.label}
              </Key>
            );
          })}
        </nav>
        </div>

        <div className="site-header-end">
        <a
          className="ui-key ui-key-ghost"
          href={GITHUB}
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub repository"
          onClick={() => playButtonSound()}
        >
          <GitHubMark />
          <span className="ui-key-label">GitHub</span>
        </a>
        </div>
      </div>
    </header>
  );
}
