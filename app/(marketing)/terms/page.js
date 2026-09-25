import LegalPage from "@/components/marketing/LegalPage";

export const metadata = {
  title: "Terms of Use",
  description: "Terms of Use draft for the Blackbird website and scoring app.",
  robots: { index: false, follow: false },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" prepared="Prepared September 23, 2026. Contact details and operating policies must be confirmed before public release.">
      <p className="mk-legal-intro">These draft terms describe the proposed rules for using the Blackbird website and Blackbird Dart Scoring System, presented by Sinitiere Labs. They are not yet effective.</p>
<h2>Using Blackbird</h2><p>Blackbird provides dart scoring, practice tools, player statistics, and connected scoreboards. Use the service lawfully, respect other players, and provide accurate account information. Account access is required to use the separate scoring app.</p>
<h2>Your Account</h2><p>Keep your sign-in credentials secure. Do not use someone else’s account without permission, impersonate another player, or deliberately submit results under another person’s identity. You are responsible for the activity you authorize through your account.</p>
<h2>Acceptable Use</h2><p>Do not use Blackbird to harass others, submit unlawful content, interfere with the service, attempt unauthorized access, or manipulate competitive results. Use room codes carefully when sharing a scoreboard with other screens.</p>
<h2>Scoring and Product Information</h2><p>Players should verify scores and agree on match rules before playing. Statistics and matchup predictions are informational and do not guarantee future results. Website previews use example data. The current app uses manual dart entry; future optical scoring hardware is not included in the current offering.</p>
<h2>Profiles and Submitted Information</h2><p>Only submit profile information and other content that you have permission to provide. Blackbird uses submitted account and game information to operate its scoring, profile, practice, and scoreboard features, as described in the Privacy Policy.</p>
<h2>Brand and Website Materials</h2><p>Blackbird’s branding, website design, and product materials are provided for viewing and use of the service. These terms do not grant permission to misrepresent affiliation with Blackbird or Sinitiere Labs.</p>
<h2>Availability and Changes</h2><p>Features may change as Blackbird develops. Maintenance, service interruptions, or device and network limitations may affect availability. Any paid offering, subscription, hardware purchase, or refund policy will require separate, clearly presented terms before it is introduced.</p>
<h2>Privacy</h2><p>Review the <a href="/privacy">Privacy Policy</a> for how account information, player visibility, Blackbird AI, browser storage, and hosting services are handled.</p>
<h2>Finalization and Contact</h2><p>The public support contact, eligibility requirements, account suspension and termination process, and any jurisdiction-specific provisions must be confirmed before these terms become effective. No purchase, subscription, or agreement is created by viewing this draft.</p>
    </LegalPage>
  );
}
