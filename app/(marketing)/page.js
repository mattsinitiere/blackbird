import { PreviewProvider } from "@/components/marketing/PreviewProvider";
import Hero from "@/components/marketing/Hero";
import Features from "@/components/marketing/Features";
import GameModes from "@/components/marketing/GameModes";
import TVSection from "@/components/marketing/TVSection";
import FAQ from "@/components/marketing/FAQ";
import Closing from "@/components/marketing/Closing";

export const metadata = {
  title: { absolute: "Blackbird — Every Dart Counts." },
  description:
    "Blackbird brings dart scoring, practice, player stats and live TV scoreboards together. Nine games. One place to play.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <main className="mk-wrap mk-main-frame" id="main">
      <PreviewProvider>
        <Hero />
        <Features />
      </PreviewProvider>
      <GameModes />
      <TVSection />
      <FAQ />
      <Closing />
    </main>
  );
}
