import type { Metadata } from "next";

import { SectionPage } from "@/components/DirectionalPage";

export const metadata: Metadata = {
  title: "How to use",
};

export default function HowToUsePage() {
  return (
    <SectionPage>
      <main className="shell" />
    </SectionPage>
  );
}
