"use client";

import { BorderBeam } from "border-beam";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { OutputShell } from "@/components/OutputShell";

export function NoticeSurface({
  children,
  role,
}: {
  children: ReactNode;

  role?: string;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const body = (
    <div
      role={role}
      className="rise notice-float"
    >
      {children}
    </div>
  );

  const beam = ready ? (
    <BorderBeam
      size="pulse-inner"
      colorVariant="mono"
      theme="dark"
      active
      strength={0.38}
      duration={3.2}
      brightness={1.15}
      borderRadius={16}
      className="notice-beam"
    >
      {body}
    </BorderBeam>
  ) : (
    <div className="notice-beam">
      {body}
    </div>
  );

  return (
    <OutputShell>
      {beam}
    </OutputShell>
  );
}
