import { LandingHero } from "~/components/landing/hero";
import { LandingNavbar } from "~/components/landing/navbar";
import { SupportsSection } from "~/components/landing/supports-section";
import { TerminalScreenshot } from "~/components/landing/terminal-screenshot";

export default function Index() {
  return (
    <>
      <LandingNavbar />
      <LandingHero />
      <SupportsSection />
      <TerminalScreenshot />
    </>
  );
}
