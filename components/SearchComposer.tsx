"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { Orb } from "@/components/fx/Orb";

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

  return (
    <form
      role="search"
      data-ready={ready ? "true" : "false"}
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
          busy || value.trim().length < 2
        }
        aria-label={
          busy
            ? "Searching"
            : "Search"
        }
        data-busy={busy ? "true" : "false"}
      >
        <Orb
          state={
            busy
              ? "searching"
              : "breathing"
          }
          size={64}
          display={30}
        />
      </button>
    </form>
  );
}
