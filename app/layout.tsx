import type { Metadata } from "next";

import { GeistMono } from "geist/font/mono";

import { GeistSans } from "geist/font/sans";

import { SiteHeader } from "@/components/SiteHeader";

import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "10K: App Research",

  description:
    "Look what thousands of competitors do, in spare seconds.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn(GeistSans.variable, GeistMono.variable, "font-sans", geist.variable)}
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
