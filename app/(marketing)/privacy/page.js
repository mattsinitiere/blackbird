import LegalPage from "@/components/marketing/LegalPage";

export const metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy draft for the Blackbird website and scoring app.",
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" prepared="Prepared September 23, 2026. Contact details and operating policies must be confirmed before public release.">
      <p className="mk-legal-intro">This draft describes how information is handled by the Blackbird product website and the separate Blackbird Dart Scoring System, presented by Sinitiere Labs.</p>
<h2>Information You Provide</h2><p>The scoring app uses email and password authentication. Your account may include a display name, player handle, profile description, home bar or town, and player preferences. The app records game results, opponents, scores, performance statistics, and practice activity.</p>
<h2>Website Previews and Background Effects</h2><p>The example scores on this website are demonstrations. The product previews, animated counters, and cursor-responsive dot grid run in your browser. This website’s current application code does not submit mouse coordinates or preview interactions to a server and does not include advertising pixels or marketing analytics.</p>
<h2>How Information Is Used</h2><p>Account and game information supports sign-in, player profiles, scoring, saved results, practice history, standings, and matchup predictions. TV pairing uses a room code to share a live scoreboard with connected screens. The website’s hosting service may process account and technical connection information to deliver and protect the site.</p>
<h2>Player and Scoreboard Visibility</h2><p>The app includes shared player profiles and competitive statistics. Other signed-in players may see player names, handles, profile details, results, and standings. A screen paired to your TV room can display live scores and match results. Avoid putting sensitive personal information into a player profile, and share TV room codes only with people you intend to include.</p>
<h2>Service Providers and Browser Storage</h2><p>The app’s documented architecture uses Supabase for authentication, data storage, and real-time scoreboard updates, and Vercel for application hosting. The app uses browser storage for features such as saved sign-in state, preferences, and recovery of an in-progress game. Hosting providers may maintain their own security and operational logs. This website does not add advertising cookies through its application code.</p>
<h2>Retention, Requests, and Your Choices</h2><p>You can edit supported profile fields through the app and manage browser storage through your device settings. Removing browser data does not itself delete account information or saved game history. The final policy must identify the privacy contact, retention periods, account deletion process, and any applicable request or appeal procedures before public release.</p>
<h2>Security and Children’s Privacy</h2><p>Authentication and access controls are part of the app’s design. No online service can guarantee absolute security. The final policy must confirm the intended age range and the process for handling information submitted by children before accounts are offered publicly.</p>
<h2>Contact and Policy Updates</h2><p>Sinitiere Labs’ privacy contact and the policy’s effective date have not yet been confirmed. They will be added before this draft becomes an effective policy. Any future collection of analytics, advertising data, payment information, or optical-scoring images must be reviewed and reflected in the policy before that collection begins.</p>
    </LegalPage>
  );
}
