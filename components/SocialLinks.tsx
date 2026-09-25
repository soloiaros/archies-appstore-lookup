"use client";

import {
  useCallback,
  useId,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

const GITHUB =
  "https://github.com/soloiaros/archies-appstore-lookup";

/* not in repo */
const X_URL: string | null = null;

const INSTAGRAM_URL: string | null = null;

function XMark() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </svg>
  );
}

function InstagramMark() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12 7.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6Zm0 7.9a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2Zm6.1-8.1a1.12 1.12 0 1 1-2.24 0 1.12 1.12 0 0 1 2.24 0ZM12 2.2c-2.67 0-3.01.01-4.06.06-2.7.12-4.16 1.57-4.28 4.28-.05 1.05-.06 1.39-.06 4.06s.01 3.01.06 4.06c.12 2.7 1.58 4.16 4.28 4.28 1.05.05 1.39.06 4.06.06s3.01-.01 4.06-.06c2.7-.12 4.16-1.58 4.28-4.28.05-1.05.06-1.39.06-4.06s-.01-3.01-.06-4.06c-.12-2.7-1.58-4.16-4.28-4.28C15.01 2.21 14.67 2.2 12 2.2Zm0 1.7c2.63 0 2.94.01 3.97.06 1.98.09 2.9 1.03 2.99 2.99.05 1.03.06 1.34.06 3.97s-.01 2.94-.06 3.97c-.09 1.95-1.01 2.9-2.99 2.99-1.03.05-1.34.06-3.97.06s-2.94-.01-3.97-.06c-1.99-.09-2.9-1.04-2.99-2.99-.05-1.03-.06-1.34-.06-3.97s.01-2.94.06-3.97c.09-1.96 1-2.9 2.99-2.99 1.03-.05 1.34-.06 3.97-.06Z"
      />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12 2C6.477 2 2 6.486 2 12.021c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.866-.013-1.7-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.622.069-.609.069-.609 1.004.071 1.532 1.033 1.532 1.033.892 1.53 2.341 1.088 2.91.833.091-.647.35-1.088.636-1.339-2.22-.253-4.555-1.113-4.555-4.952 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.56 9.56 0 0 1 2.504.337c1.909-1.296 2.747-1.026 2.747-1.026.546 1.378.203 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.944.359.31.678.92.678 1.855 0 1.338-.012 2.417-.012 2.745 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.021C22 6.486 17.523 2 12 2Z"
      />
    </svg>
  );
}

function DoorFace() {
  return (
    <div className="locker-face" aria-hidden>
      <span className="locker-vents">
        <span />
        <span />
        <span />
        <span />
        <span />
      </span>

      <span className="locker-dots">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}

function IconLink({
  href,
  label,
  children,
  tabIndex,
}: {
  href: string | null;

  label: string;

  children: ReactNode;

  tabIndex: number;
}) {
  if (!href) {
    return (
      <span
        className="locker-link"
        aria-label={label}
        aria-disabled="true"
        title={`${label} link not set`}
      >
        {children}
      </span>
    );
  }

  return (
    <a
      className="locker-link"
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      tabIndex={tabIndex}
    >
      {children}
    </a>
  );
}

export function SocialLinks() {
  const [open, setOpen] = useState(false);

  const panelId = useId();

  const toggle = useCallback(() => {
    setOpen((value) => !value);
  }, []);

  const onDoorKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle();
      }

      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false);
      }
    },
    [open, toggle],
  );

  const linkTab = open ? 0 : -1;

  return (
    <div
      className="locker"
      data-open={open ? "true" : "false"}
      style={{ viewTransitionName: "social-locker" }}
    >
      <div className="locker-scene">
        <div
          className="locker-bay"
          id={panelId}
          role="region"
          aria-label="Social links"
          aria-hidden={!open}
          inert={!open ? true : undefined}
        >
          <nav className="locker-shelf" aria-label="Social">
            <IconLink href={X_URL} label="X" tabIndex={linkTab}>
              <XMark />
            </IconLink>

            <IconLink
              href={INSTAGRAM_URL}
              label="Instagram"
              tabIndex={linkTab}
            >
              <InstagramMark />
            </IconLink>

            <a
              className="locker-link locker-github"
              href={GITHUB}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              tabIndex={linkTab}
            >
              <GitHubMark />
              <span>GitHub</span>
            </a>
          </nav>
        </div>

        <button
          type="button"
          className="locker-door"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Close social locker" : "Open social locker"}
          onClick={toggle}
          onKeyDown={onDoorKeyDown}
        >
          <span className="locker-door-front">
            <DoorFace />
          </span>

          <span className="locker-door-back">
            <DoorFace />
          </span>

          <span className="locker-handle" aria-hidden>
            <span className="locker-rose">
              <span className="locker-screw" />
              <span className="locker-screw" />
              <span className="locker-keyhole" />
            </span>

            <span className="locker-lever">
              <span className="locker-lever-shade" />
              <span className="locker-lever-body" />
            </span>

            <span className="locker-boss" />
          </span>
        </button>
      </div>
    </div>
  );
}
