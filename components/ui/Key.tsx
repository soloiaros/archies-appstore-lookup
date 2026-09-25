import Link from "next/link";

import type { ReactNode } from "react";

export function Key({
  href,
  current = false,
  children,
  className,
}: {
  href: string;

  current?: boolean;

  children: ReactNode;

  className?: string;
}) {
  const classes = ["ui-key", className]
    .filter(Boolean)
    .join(" ");

  return (
    <Link
      href={href}
      className={classes}
      aria-current={current ? "page" : undefined}
      transitionTypes={["section"]}
    >
      <span className="ui-key-label">{children}</span>
    </Link>
  );
}
