import { SectionPage } from "@/components/DirectionalPage";

import { VendingMachineScene } from "@/components/VendingMachineScene";

export default function HomePage() {
  return (
    <SectionPage>
      <main className="home">
        <section className="home-hero" aria-label="10K">
          <h1 className="home-hero-title">10K</h1>
        </section>

        <section className="home-machine" aria-label="Vending machine">
          <VendingMachineScene />
        </section>
      </main>
    </SectionPage>
  );
}
