"use client";

import Link from "next/link";

import { usePathname } from "next/navigation";

import { Key } from "@/components/ui/Key";

import { Well } from "@/components/ui/Well";

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

      <Well className="nav-well">
        <nav
          className="nav-keys"
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
                led
              >
                {item.label}
              </Key>
            );
          })}
        </nav>
      </Well>
    </header>
  );
}
