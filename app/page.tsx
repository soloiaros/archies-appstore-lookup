import { HomeFooter } from "@/components/HomeFooter";

import { SectionPage } from "@/components/DirectionalPage";

import { VendingMachineScene } from "@/components/VendingMachineScene";

export default function HomePage() {
  return (
    <SectionPage>
      <main className="home">
        <section className="home-hero" aria-label="10K">
          <h1 className="home-hero-title">10K</h1>
        </section>

        <footer className="home-machine" aria-label="Site footer">
          <VendingMachineScene />
          <HomeFooter />
        </footer>
      </main>
    </SectionPage>
  );
}
