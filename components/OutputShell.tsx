import type { CSSProperties, ReactNode } from "react";

const frost: CSSProperties = {
  backdropFilter: "blur(72px) saturate(1.8)",
  WebkitBackdropFilter: "blur(72px) saturate(1.8)",
};

export function OutputShell({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="answer-float">
      <div
        className="output-frost"
        style={frost}
        aria-hidden
      />

      {children}
    </div>
  );
}
