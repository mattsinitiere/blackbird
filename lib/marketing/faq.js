/**
 * FAQ copy. The home page shows the first five; /faq shows all of them and
 * publishes them as FAQPage structured data, so answers stay plain text.
 */
export const FAQS = [
  {
    q: "Do I need special hardware?",
    a: "No special scoring hardware is needed for the current app. Use your dartboard and enter your darts on a phone, tablet, or computer.",
  },
  {
    q: "Do I need an account?",
    a: "Yes. Play opens the Blackbird scoring app. If you’re already signed in, you go straight to your game hub. Otherwise you’ll see the sign-in page. Sign-up currently uses an invite code, so ask the person who invited you for it.",
  },
  {
    q: "Can I practice on my own?",
    a: "Yes. Play solo, take on the bot ladder, or use Bob’s 27, checkout drills, and scoring drills. Practice is recorded separately and doesn’t affect competitive Elo or standings.",
  },
  {
    q: "How does the TV scoreboard work?",
    a: "Choose Cast to TV during a game. Open Blackbird’s TV page in a TV browser or a browser you can cast, then enter the four-character code from your phone. Your phone becomes the scoring control.",
    link: { href: "/tv", text: "Open TV scoreboard" },
  },
  {
    q: "Does Blackbird automatically detect my darts?",
    a: "The current app uses manual score entry. Optical scoring hardware is a future direction, not a feature being offered on this site.",
  },
  {
    q: "What can I ask Blackbird AI?",
    a: "Anything about your own darts: how your doubles are trending, how you match up with a rival, what went wrong in last night’s match, or what to practice next. Each account can ask up to 50 questions a day.",
    link: { href: "/features/coaching", text: "See coaching features" },
  },
  {
    q: "What does Blackbird AI use to answer?",
    a: "It answers from Blackbird game data: your games and stats, and the shared results of players you ask about. To write an answer, your question and the data it needs are sent to an AI model provider. Your conversation is kept in your browser, not in Blackbird’s database.",
    link: { href: "/privacy", text: "Read the privacy policy" },
  },
  {
    q: "Who is Merlin?",
    a: "Merlin is your Blackbird coach. The Merlin card on your home screen checks in on your training from your saved games, and Ask Merlin opens Blackbird AI. Merlin can also draft a training plan for you.",
  },
  {
    q: "Can I install Blackbird or play offline?",
    a: "Yes. Add Blackbird to your home screen from your browser and it opens like an app. If your connection drops mid-game, finished games are saved on the device and sync when you’re back online.",
  },
];
