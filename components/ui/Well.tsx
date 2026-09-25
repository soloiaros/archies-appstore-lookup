import type { ReactNode } from "react";

export function Well({
  children,
  className,
}: {
  children: ReactNode;

  className?: string;
}) {
  const classes = className ? `ui-well ${className}` : "ui-well";

  return (
    <div className={classes}>
      {children}
    </div>
  );
}
