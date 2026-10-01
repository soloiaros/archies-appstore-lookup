"use client";

import { BorderBeam } from "border-beam";
import {
  useEffect,
  useRef,
  useState,
} from "react";

const PROMPTS = [
  "Show me the apps with a dog logo.",
  "Show me sport related apps with the most revenue in 2026.",
  "i'm building a cooking app with an ai assistant, show my competitors.",
  "I need some ideas for a mascot icon.",
  "Show me quirky apps with the most unique visual style/features.",
  "i'm building a niche camera app, show me what's out there already.",
  "Find meditation apps with the highest ratings.",
  "I'm looking for a journaling app with a paper texture.",
  "Compare Notion and Obsidian.",
  "habit trackers with streaks and a clean interface",
] as const;

const FALLBACK = PROMPTS[0];

const TYPE_MS = 46;

const DELETE_MS = 24;

const HOLD_MS = 1800;

const GAP_MS = 420;

function jitter(base: number, spread: number) {
  return base + Math.floor((Math.random() * 2 - 1) * spread);
}

type Props = {
  value: string;

  onChange: (value: string) => void;

  onSubmit: (value: string) => void;

  onClear: () => void;

  busy: boolean;

  /** Swap the submit control for a clear control (same as Escape). */
  clearable?: boolean;
};

export function SearchComposer({
  value,
  onChange,
  onSubmit,
  onClear,
  busy,
  clearable = false,
}: Props) {
  const input = useRef<HTMLInputElement>(null);

  const [ready, setReady] = useState(false);

  const [hint, setHint] = useState<string>(FALLBACK);

  const [focused, setFocused] = useState(false);

  const promptAt = useRef(0);

  const empty = value.trim().length === 0;

  const animate = ready && empty && !focused;

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

  useEffect(() => {
    if (!animate) {
      return;
    }

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    if (reduce.matches) {
      setHint(FALLBACK);
      return;
    }

    const signal = { dead: false };

    let timer = 0;

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timer = window.setTimeout(resolve, ms);
      });

    const run = async () => {
      while (!signal.dead) {
        const prompt = PROMPTS[promptAt.current % PROMPTS.length];

        promptAt.current += 1;

        for (let i = 1; i <= prompt.length; i++) {
          if (signal.dead) {
            return;
          }

          setHint(prompt.slice(0, i));

          await wait(jitter(TYPE_MS, 14));
        }

        if (signal.dead) {
          return;
        }

        await wait(HOLD_MS);

        if (signal.dead) {
          return;
        }

        for (let i = prompt.length - 1; i >= 0; i--) {
          if (signal.dead) {
            return;
          }

          setHint(prompt.slice(0, i));

          await wait(jitter(DELETE_MS, 8));
        }

        if (signal.dead) {
          return;
        }

        await wait(GAP_MS);
      }
    };

    void run();

    return () => {
      signal.dead = true;
      window.clearTimeout(timer);
    };
  }, [animate]);

  const submit = () => {
    onSubmit(input.current?.value ?? value);
  };

  const clear = () => {
    onClear();
    input.current?.blur();
  };

  const form = (
    <form
      role="search"
      data-ready={ready ? "true" : "false"}
      data-busy={busy ? "true" : "false"}
      data-clearable={clearable ? "true" : "false"}
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
        autoComplete="off"
        spellCheck={false}
        maxLength={300}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onFocus={() => {
          setFocused(true);
        }}
        onBlur={() => {
          setFocused(false);
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
            clear();
          }
        }}
        placeholder={focused ? "" : hint}
      />

      {clearable ? (
        <button
          type="button"
          aria-label="Clear"
          onClick={clear}
        >
          ×
        </button>
      ) : (
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
      )}
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
