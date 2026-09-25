"use client";

import Link from "next/link";

import { usePathname } from "next/navigation";

import { MetalKey } from "@/components/MetalKey";

const NAV = [
  {
    href: "/search",
    label: "Search",
    primary: true,
  },
  {
    href: "/how-to-use",
    label: "How to use",
    primary: false,
  },
  {
    href: "/studio",
    label: "Studio",
    primary: false,
  },
] as const;

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

export function SiteHeader() {
  const pathname = usePathname();

  const home = pathname === "/";

  return (
    <header
      className="site-header"
      style={{ viewTransitionName: "site-header" }}
    >
      <Link
        href="/"
        className="brand"
        aria-label="10K home"
        aria-current={home ? "page" : undefined}
        transitionTypes={["section"]}
      >
        <span className="brand-plate" aria-hidden>
          <BrandMark />
        </span>

        <span className="brand-word">10K</span>
      </Link>

      <nav
        className="nav-well"
        aria-label="Primary"
      >
        {NAV.map((item) => {
          const current =
            pathname === item.href
            || pathname.startsWith(`${item.href}/`);

          return (
            <MetalKey
              key={item.href}
              href={item.href}
              current={current}
              primary={item.primary}
            >
              {item.label}
            </MetalKey>
          );
        })}
      </nav>
    </header>
  );
}
