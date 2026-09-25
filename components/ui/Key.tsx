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
  const classes = className ? `ui-key ${className}` : "ui-key";

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
