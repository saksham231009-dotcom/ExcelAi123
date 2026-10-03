import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import {
  Features,
  Footer,
  HowItWorks,
  Pricing,
  Principles,
} from "@/components/landing/Sections";

export default function Home() {
  return (
    <>
      <div className="bg-neutral-950">
        <Header />
        <main>
          <Hero />
        </main>
      </div>
      <Principles />
      <Features />
      <HowItWorks />
      <Pricing />
      <Footer />
    </>
  );
}
