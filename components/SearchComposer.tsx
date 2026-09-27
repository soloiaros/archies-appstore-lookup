"use client";

import { BorderBeam } from "border-beam";
import {
  useEffect,
  useRef,
  useState,
} from "react";

type Props = {
  value: string;

  onChange: (value: string) => void;

  onSubmit: (value: string) => void;

  onClear: () => void;

  busy: boolean;
};

export function SearchComposer({
  value,
  onChange,
  onSubmit,
  onClear,
  busy,
}: Props) {
  const input = useRef<HTMLInputElement>(null);

  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);

    const typed = input.current?.value;

    if (typed && typed !== value) {
      onChange(typed);
    }
    // adopt once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing =
        document.activeElement
        instanceof HTMLInputElement;

      if (event.key === "/" && !typing) {
        event.preventDefault();
        input.current?.focus();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const submit = () => {
    onSubmit(input.current?.value ?? value);
  };

  const form = (
    <form
      role="search"
      data-ready={ready ? "true" : "false"}
      data-busy={busy ? "true" : "false"}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="composer"
    >
      <label htmlFor="q" className="sr">
        Describe an app
      </label>

      <input
        id="q"
        ref={input}
        autoFocus
        autoComplete="off"
        spellCheck={false}
        maxLength={300}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onKeyDown={(event) => {
          if (
            event.key === "Enter"
            && !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            submit();
          }

          if (event.key === "Escape") {
            onClear();
            input.current?.blur();
          }
        }}
        placeholder="Describe an app"
      />

      <button
        type="submit"
        disabled={
          ready
            ? busy || value.trim().length < 2
            : false
        }
        aria-label={
          busy
            ? "Searching"
            : "Search"
        }
        data-busy={busy ? "true" : "false"}
      >
        ↑
      </button>
    </form>
  );

  if (!ready) return form;

  return (
    <BorderBeam
      size="pulse-inner"
      colorVariant={busy ? "colorful" : "mono"}
      theme="dark"
      active
      strength={busy ? 1 : 0.38}
      duration={busy ? 1.35 : 3.2}
      brightness={busy ? 1.55 : 1.15}
      borderRadius={16}
      className="composer-beam"
    >
      {form}
    </BorderBeam>
  );
}
