import type { Metadata } from "next";

import { GeistMono } from "geist/font/mono";

import { GeistSans } from "geist/font/sans";

import { SiteHeader } from "@/components/SiteHeader";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "10K",
    template: "%s · 10K",
  },

  description:
    "Find App Store apps by what they do, with provenance on every field.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body
        className="font-sans antialiased"
        suppressHydrationWarning
      >
        <SiteHeader />

        {children}
      </body>
    </html>
  );
}
