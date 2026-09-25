import Link from "next/link";

import type { ReactNode } from "react";

export function MetalKey({
  href,
  current = false,
  primary = false,
  children,
}: {
  href: string;

  current?: boolean;

  primary?: boolean;

  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="metal-key"
      data-default={primary ? "true" : undefined}
      aria-current={current ? "page" : undefined}
      transitionTypes={["section"]}
    >
      <span className="metal-key-label">{children}</span>
    </Link>
  );
}
