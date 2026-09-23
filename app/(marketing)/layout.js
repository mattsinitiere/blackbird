import "./marketing.css";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import Footer from "@/components/marketing/Footer";
import ForceLight from "@/components/marketing/ForceLight";
import StandaloneRedirect from "@/components/StandaloneRedirect";

export default function MarketingLayout({ children }) {
  return (
    <div className="mk-root">
      <a className="mk-skip" href="#main">
        Skip to content
      </a>
      <MarketingHeader />
      {children}
      <Footer />
      <ForceLight />
      <StandaloneRedirect />
    </div>
  );
}
