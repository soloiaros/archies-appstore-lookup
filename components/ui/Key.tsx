import Link from "next/link";

import type { ReactNode } from "react";

import { Indicator } from "@/components/ui/Indicator";

export function Key({
  href,
  current = false,
  led = false,
  children,
  className,
}: {
  href: string;

  current?: boolean;

  led?: boolean;

  children: ReactNode;

  className?: string;
}) {
  const classes = [
    "ui-key",
    led ? "ui-key-led" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link
      href={href}
      className={classes}
      aria-current={current ? "page" : undefined}
      transitionTypes={["section"]}
    >
      {led ? <Indicator on={current} /> : null}

      <span className="ui-key-label">{children}</span>
    </Link>
  );
}
