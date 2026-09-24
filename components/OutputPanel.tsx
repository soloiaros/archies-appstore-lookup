"use client";

import { BorderBeam } from "border-beam";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Props = {
  children: ReactNode;

  className?: string;

  "data-shape"?: string;
};

export function OutputPanel({
  children,
  className,
  "data-shape": shape,
}: Props) {
  const scroll = useRef<HTMLDivElement>(null);

  const body = useRef<HTMLDivElement>(null);

  const [ready, setReady] = useState(false);

  const [above, setAbove] = useState(false);

  const [below, setBelow] = useState(false);

  useEffect(() => {
    const el = scroll.current;

    const inner = body.current;

    if (!el || !inner) {
      return;
    }

    const sync = () => {
      const top = el.scrollTop;

      const room =
        el.scrollHeight - el.clientHeight;

      setAbove(top > 1);

      setBelow(room - top > 1);
    };

    sync();

    const raf = requestAnimationFrame(sync);

    el.addEventListener("scroll", sync, {
      passive: true,
    });

    const ro = new ResizeObserver(sync);

    ro.observe(el);
    ro.observe(inner);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, [ready]);

  useEffect(() => {
    setReady(true);
  }, []);

  const frame = (
    <div
      className={
        className
          ? `panel-frame ${className}`
          : "panel-frame"
      }
      data-shape={shape}
      data-above={above ? "true" : "false"}
      data-below={below ? "true" : "false"}
    >
      <div
        className="panel-edge panel-edge-top backdrop-blur-[10px]"
        aria-hidden
      />

      <div
        className="panel-edge panel-edge-bottom backdrop-blur-[10px]"
        aria-hidden
      />

      <div
        ref={scroll}
        className="panel"
      >
        <div
          ref={body}
          className="panel-body"
        >
          {children}
        </div>
      </div>
    </div>
  );

  if (!ready) {
    return frame;
  }

  return (
    <BorderBeam
      size="pulse-inner"
      colorVariant="mono"
      theme="dark"
      active
      strength={0.38}
      duration={3.2}
      brightness={1.15}
      borderRadius={16}
      className="panel-beam"
    >
      {frame}
    </BorderBeam>
  );
}
