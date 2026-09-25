import LegalPage from "@/components/marketing/LegalPage";

export const metadata = {
  title: "Privacy Policy",
  description: "How Blackbird and Sinitiere Labs collect, use, keep, and delete information, including Blackbird AI.",
  robots: { index: false, follow: false },
};

// Change both when the policy changes; material changes are announced first.
const EFFECTIVE = "September 25, 2026";
const UPDATED = "September 25, 2026";
const CONTACT = "privacy@sinitiere.dev";

const Mail = ({ subject }) => <a href={`mailto:${CONTACT}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`}>{CONTACT}</a>;

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" effective={EFFECTIVE} updated={UPDATED}>
      <p className="mk-legal-intro">
        This policy explains how Sinitiere Labs (“we”, “us”) handles information through the Blackbird website and the Blackbird Dart Scoring System app (together, “Blackbird”). Questions or requests: <Mail />.
      </p>

      <h2>Who Blackbird Is For</h2>
      <p>Blackbird is for adults 18 and over in the United States. It isn’t directed at children, and we don’t knowingly collect information from anyone under 18. If we learn that an account belongs to someone under 18, we delete it as described below. A parent or guardian who believes a child has an account can contact us at <Mail subject="Under-18 account" />.</p>

      <h2>Information You Provide</h2>
      <p>The scoring app uses email and password authentication. Your account may include a display name, player handle, profile description, home bar or town, profile colour, cover and name tag, and player preferences such as gameplay, strategy hint, and answer style settings. The app records game results, opponents, scores, dart-by-dart logs, performance statistics, practice activity, and the players you follow.</p>

      <h2>Information Created as You Use the App</h2>
      <p>The app records the days you open it and when you complete parts of your profile, which power streak and profile achievements. If you use training plans, the plans you create or accept and your progress through them are saved to your account. Strategy hints, Alter Ego, and the Merlin card are calculated from your own saved games inside Blackbird; they do not send your data to an AI provider.</p>

      <h2>Blackbird AI</h2>
      <p>When you ask Blackbird AI a question, use an Ask AI shortcut, request a match summary, or ask Merlin to draft a training plan, Blackbird sends a request to a third-party AI model provider (currently OpenAI) to write the answer. That request includes your question, recent messages from the same conversation, and the Blackbird game data needed to answer it: your own games and statistics and, when you ask about other players, their shared results and statistics. The provider processes this information under its own terms and data policies. Please don’t include sensitive personal information in your questions.</p>
      <p>Your Blackbird AI conversation is kept in your browser on the device you used, not in Blackbird’s database. For each request, Blackbird’s servers keep an operational record: the type of request, the model used, token counts, duration, and whether it succeeded. They also keep a daily count used for the 50-request daily limit. These records do not include your question, the answer, or the game data that was sent.</p>

      <h2>Website Previews and Background Effects</h2>
      <p>The example scores, conversations, and statistics on this website are demonstrations. The product previews, animated counters, and cursor-responsive dot grid run in your browser. The website doesn’t send mouse movements or preview interactions to a server and doesn’t include advertising pixels or marketing analytics.</p>

      <h2>How Information Is Used</h2>
      <p>Account and game information supports sign-in, player profiles, scoring, saved results, practice history, standings, achievements, matchup predictions, training plans, and AI coaching answers. TV pairing uses a room code to share a live scoreboard with connected screens. We can view account lists and usage figures, such as sign-ups, activity, games played, and AI request counts and estimated costs, to run, support, and protect the service. Our hosting provider may process account and technical connection information to deliver and protect the site.</p>
      <p>We don’t sell personal information, share it for cross-context behavioural advertising, or use it for targeted advertising, and we don’t track you across other websites. Because of that, browser signals such as Do Not Track and Global Privacy Control don’t change how Blackbird behaves.</p>

      <h2>Player and Scoreboard Visibility</h2>
      <p>The app includes shared player profiles and competitive statistics. Other signed-in players may see player names, handles, profile details, results, standings, achievements, and head-to-head records, and may ask Blackbird AI about those shared results. A screen paired to your TV room can display live scores and match results. A player card you export or share shows what is on the card to anyone you send it to. Avoid putting sensitive personal information into a player profile, and share TV room codes only with people you intend to include.</p>

      <h2>Service Providers and Browser Storage</h2>
      <p>Blackbird uses Supabase for authentication, data storage, and real-time scoreboard updates, Vercel for hosting, and a third-party AI model provider (currently OpenAI) for Blackbird AI answers. These providers process information on our behalf to run those services. The app uses browser storage for features such as saved sign-in state, preferences, recovery of an in-progress game, games saved while offline until they sync, your Blackbird AI conversation, cached match summaries, TV display settings, and the files that let the installed app open without a connection. Blackbird doesn’t set advertising cookies.</p>

      <h2>How Long We Keep Information</h2>
      <ul>
        <li><strong>Account, profile, games, and practice history:</strong> kept while your account exists, so your stats and records stay complete.</li>
        <li><strong>AI request records, daily AI counts, app-visit records, and training plans:</strong> kept while your account exists and deleted with it.</li>
        <li><strong>After you delete your account:</strong> games you played stay in other players’ histories, standings, and head-to-head records, credited to “Deleted player” with no name or profile details, because those games are part of their records too.</li>
        <li><strong>Backups:</strong> copies may remain in our database provider’s routine backups until those backups expire on their normal schedule. We don’t restore deleted accounts from them.</li>
        <li><strong>Hosting and security logs:</strong> kept by our providers under their own retention policies.</li>
        <li><strong>On your device:</strong> your Blackbird AI conversation and any games waiting to sync stay in your browser until you clear its storage. Clearing it also discards games that haven’t synced yet.</li>
      </ul>

      <h2>Your Choices and Requests</h2>
      <ul>
        <li><strong>See or copy your data:</strong> download your results any time in the app under Settings → Export Data (CSV or JSON), or ask us for a copy of the personal information we hold about you.</li>
        <li><strong>Correct it:</strong> edit your profile in the app, or ask us to fix anything you can’t change yourself.</li>
        <li><strong>Limit it:</strong> turn strategy hints off, choose whether to use Blackbird AI, and clear browser storage through your device settings.</li>
        <li><strong>Delete your account:</strong> email <Mail subject="Delete my account" /> from the address on your account. Deleting it removes your login, your AI request records and daily counts, app-visit records, training plans, and the players you follow, and clears your profile (handle, bio, town, tag, cover, and colour). Your past games stay in other players’ records as “Deleted player”, as described above. Deletion can’t be undone.</li>
      </ul>
      <p>To protect your account, we confirm a request comes from the account holder, usually by replying to the account’s email address. We respond within 30 days and tell you what we did. You won’t be treated differently for making a request.</p>

      <h2>Appeals</h2>
      <p>If we decline all or part of a request, we’ll explain why. You can appeal by replying to that email, or by writing to <Mail subject="Appeal" /> with “Appeal” in the subject line, within 60 days. We’ll respond to an appeal within 45 days and explain the outcome. If you’re not satisfied, you can contact your state attorney general.</p>

      <h2>Security</h2>
      <p>Blackbird uses authentication, row-level access controls in the database, and encrypted connections. Only the account operator can use the admin tools. No online service can guarantee absolute security, so use a strong password that you don’t use elsewhere, and tell us at <Mail subject="Security" /> if you think your account has been misused.</p>

      <h2>Changes to This Policy</h2>
      <p>When this policy changes, we update the dates at the top. For material changes, including a change of AI provider or any new collection such as analytics, advertising data, payment information, or optical-scoring images, we’ll tell signed-in players in the app or by email before the change takes effect.</p>

      <h2>Contact</h2>
      <p>Sinitiere Labs · <Mail /></p>
    </LegalPage>
  );
}
