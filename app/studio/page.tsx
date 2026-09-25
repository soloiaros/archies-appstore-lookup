import type { Metadata } from "next";

import { SectionPage } from "@/components/DirectionalPage";

export const metadata: Metadata = {
  title: "Studio",
};

export default function StudioPage() {
  return (
    <SectionPage>
      <main className="shell" />
    </SectionPage>
  );
}
