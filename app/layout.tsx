import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "App Store Indexor",

  description:
    "Find App Store apps by what they do, with provenance on every field.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
