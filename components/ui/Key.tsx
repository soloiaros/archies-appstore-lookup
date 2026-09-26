import Link from "next/link";

import type { MouseEventHandler, ReactNode } from "react";

export function Key({
  href,
  current = false,
  children,
  className,
  onClick,
}: {
  href: string;

  current?: boolean;

  children: ReactNode;

  className?: string;

  onClick?: MouseEventHandler<HTMLAnchorElement>;
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
      onClick={onClick}
    >
      <span className="ui-key-label">{children}</span>
    </Link>
  );
}
