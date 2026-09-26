import Link from "next/link";

const GITHUB_REPO =
  "https://github.com/soloiaros/archies-appstore-lookup";

const GITHUB_AUTHOR = "https://github.com/soloiaros";

const ARCHIE_URL = "https://github.com/archieauburn";

const INSTAGRAM_URL = "https://instagram.com";

const X_URL = "https://x.com";

const LINKS = [
  {
    href: "/search",
    label: "Search",
  },
  {
    href: "/how-to-use",
    label: "How to use",
  },
  {
    href: "/studio",
    label: "Studio",
  },
] as const;

function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12 7.2A4.8 4.8 0 1 0 12 16.8 4.8 4.8 0 0 0 12 7.2Zm0 7.9A3.1 3.1 0 1 1 12 8.9a3.1 3.1 0 0 1 0 6.2Zm6.3-8.1a1.12 1.12 0 1 1-2.24 0 1.12 1.12 0 0 1 2.24 0ZM12 3.5c-2.3 0-2.59.01-3.5.05-.9.04-1.52.19-2.06.4a4.16 4.16 0 0 0-1.5.98 4.16 4.16 0 0 0-.98 1.5c-.21.54-.36 1.16-.4 2.06-.04.91-.05 1.2-.05 3.5s.01 2.59.05 3.5c.04.9.19 1.52.4 2.06.22.57.51 1.05.98 1.5.45.47.93.76 1.5.98.54.21 1.16.36 2.06.4.91.04 1.2.05 3.5.05s2.59-.01 3.5-.05c.9-.04 1.52-.19 2.06-.4a4.16 4.16 0 0 0 1.5-.98 4.16 4.16 0 0 0 .98-1.5c.21-.54.36-1.16.4-2.06.04-.91.05-1.2.05-3.5s-.01-2.59-.05-3.5c-.04-.9-.19-1.52-.4-2.06a4.16 4.16 0 0 0-.98-1.5 4.16 4.16 0 0 0-1.5-.98c-.54-.21-1.16-.36-2.06-.4-.91-.04-1.2-.05-3.5-.05Zm0 1.53c2.26 0 2.53.01 3.42.05.83.04 1.28.18 1.58.29.4.16.68.34.98.64.3.3.48.58.64.98.12.3.25.75.29 1.58.04.89.05 1.16.05 3.42s-.01 2.53-.05 3.42c-.04.83-.18 1.28-.29 1.58-.16.4-.34.68-.64.98-.3.3-.58.48-.98.64-.3.12-.75.25-1.58.29-.89.04-1.16.05-3.42.05s-2.53-.01-3.42-.05c-.83-.04-1.28-.18-1.58-.29a2.63 2.63 0 0 1-.98-.64 2.63 2.63 0 0 1-.64-.98c-.12-.3-.25-.75-.29-1.58-.04-.89-.05-1.16-.05-3.42s.01-2.53.05-3.42c.04-.83.18-1.28.29-1.58.16-.4.34-.68.64-.98.3-.3.58-.48.98-.64.3-.12.75-.25 1.58-.29.89-.04 1.16-.05 3.42-.05Z"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.727-8.835L1.5 2.25h6.908l4.262 5.685L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12 2C6.477 2 2 6.486 2 12.021c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.866-.013-1.7-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.071 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.339-2.22-.253-4.555-1.113-4.555-4.952 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.026 2.747-1.026.546 1.378.203 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.944.359.31.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.021C22 6.486 17.523 2 12 2Z"
      />
    </svg>
  );
}

export function HomeFooter() {
  return (
    <div className="home-footer">
      <div className="home-footer-copy">
        <p className="home-footer-mark">10K</p>

        <p className="home-footer-lede">
          Find App Store apps by what they do, with
          provenance on every field.
        </p>

        <nav
          className="home-footer-nav"
          aria-label="Footer"
        >
          {LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="home-footer-link"
              transitionTypes={["section"]}
            >
              {item.label}
            </Link>
          ))}

          <a
            className="home-footer-link"
            href={GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </nav>
      </div>

      <div className="home-footer-meta">
        <p className="home-footer-credit">
          made by{" "}
          <a
            className="home-footer-credit-link"
            href={ARCHIE_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Archie Auburn
          </a>
        </p>

        <div className="home-footer-social">
          <a
            className="home-footer-social-btn"
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
          >
            <InstagramIcon />
          </a>

          <a
            className="home-footer-social-btn"
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X"
          >
            <XIcon />
          </a>

          <a
            className="home-footer-social-btn"
            href={GITHUB_AUTHOR}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
          >
            <GitHubIcon />
          </a>
        </div>

        <p className="home-footer-note">
          App Store is a trademark of Apple Inc.
        </p>
      </div>
    </div>
  );
}
