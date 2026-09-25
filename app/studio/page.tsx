import type { Metadata } from "next";

import { SectionPage } from "@/components/DirectionalPage";

export const metadata: Metadata = {
  title: "Studio",
};

export default function StudioPage() {
  return (
    <SectionPage>
      <main className="sheet">
        <h1>Studio</h1>

        <p className="sheet-lead">
          The bench for tuning 10K. Empty for now.
        </p>
      </main>
    </SectionPage>
  );
}
