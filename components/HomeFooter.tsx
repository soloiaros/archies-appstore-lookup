import Link from "next/link";

const GITHUB =
  "https://github.com/soloiaros/archies-appstore-lookup";

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

export function HomeFooter() {
  return (
    <div className="home-footer">
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
          href={GITHUB}
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </nav>

      <p className="home-footer-note">
        App Store is a trademark of Apple Inc.
      </p>
    </div>
  );
}
