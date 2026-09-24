import { ViewTransition } from "react";

import type { ReactNode } from "react";

export function DirectionalPage({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ViewTransition
      enter={{
        "nav-forward": "nav-forward",
        "nav-back": "nav-back",
        default: "none",
      }}
      exit={{
        "nav-forward": "nav-forward",
        "nav-back": "nav-back",
        default: "none",
      }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}

export function SearchPage({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ViewTransition
      enter={{
        "nav-forward": "fade-in",
        "nav-back": "fade-in",
        default: "none",
      }}
      exit={{
        "nav-forward": "nav-forward",
        "nav-back": "nav-back",
        default: "none",
      }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
