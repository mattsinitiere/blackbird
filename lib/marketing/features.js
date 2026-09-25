/**
 * Copy for the four feature pages (/features/[slug]) and the cards that
 * link to them. Each row's `visual` names a mock in
 * components/marketing/Mocks.js.
 */
export const FEATURE_PAGES = [
  {
    slug: "scoring",
    nav: "Scoring",
    icon: "↗",
    eyebrow: "MATCH SCORING",
    title: ["Keep the Match Moving.", "Let Blackbird Do the Math."],
    intro: "Enter each dart, follow the score, and fix a mis-tap in one touch. Every game ends with a match report worth reading.",
    card: "Fast dart-by-dart entry, best-of matches, offline saves, and a match report after every game.",
    description: "Score nine dart games dart by dart, with undo, best-of matches, offline saves and a match report with a recap chart after every game.",
    rows: [
      {
        label: "EVERY DART, IN ORDER",
        title: "Tap In. Throw On.",
        copy: "Enter darts as you throw them on a phone, tablet, or computer. Blackbird keeps the remaining score, the averages, and whose turn it is.",
        points: ["Undo a mis-tap in one touch", "Single leg or best of 3, 5, or 7", "Nine game modes, from X01 to Tic-Tac-Toe"],
        visual: "scoring",
      },
      {
        label: "AFTER THE LAST DART",
        title: "Read the Match Back.",
        copy: "Each finished game opens a match report: the winner, every player’s numbers, and a recap chart that shows how the game turned.",
        points: ["A recap chart of how the game unfolded", "Averages, checkouts, and marks per round", "Open any past game from your history"],
        visual: "report",
      },
      {
        label: "ON THE ROAD, IN THE BASEMENT",
        title: "Weak Signal? Keep Playing.",
        copy: "Blackbird installs to your home screen and keeps scoring when the connection drops. Games save on the device and sync when you’re back online.",
        points: ["Install from the browser, no app store", "Offline games sync automatically", "Everyone’s stats stay in step"],
        visual: "sync",
      },
    ],
    cta: { label: "YOUR NEXT MATCH", title: "Chalk Is Optional." },
  },
  {
    slug: "coaching",
    nav: "Coaching",
    icon: "✦",
    isNew: true,
    eyebrow: "BLACKBIRD AI COACHING",
    title: ["A Coach Who Knows", "Every Dart You’ve Thrown."],
    intro: "Ask about your game in plain words. Blackbird AI reads your own stats and answers with charts, comparisons, and a plan you can start today.",
    card: "Ask Blackbird AI about your game, follow a training plan, and get checkout advice while you play.",
    description: "Blackbird AI answers questions about your darts with your own stats, builds training plans, and suggests checkout routes as you play.",
    rows: [
      {
        label: "BLACKBIRD AI",
        title: "Ask. Get a Real Answer.",
        copy: "“Why do I miss doubles late in a leg?” Blackbird AI looks at your games and answers in seconds, with charts and head-to-head comparisons where they help.",
        points: ["Answers built from your own games", "Charts, badges, and head-to-head widgets", "Brief, Balanced, or Detailed answer style"],
        visual: "ai",
      },
      {
        label: "ASK FROM ANYWHERE",
        title: "The Right Question, One Tap Away.",
        copy: "Shortcuts across the app open Blackbird AI with the question already asked: scout a rival, break down a match, or read your stats.",
        points: ["Scout with AI from any matchup", "Ask AI about a finished game", "Build me a practice plan"],
        visual: "askai",
      },
      {
        label: "TRAINING PLANS",
        title: "A Plan You’ll Actually Follow.",
        copy: "Let Merlin, your Blackbird coach, draft a plan from your recent form, or build one yourself. After each game, the next drill is waiting.",
        points: ["Up to three plans at a time", "Drills, solo X01, bots, and Alter Ego", "Progress tracked as you play"],
        visual: "plan",
      },
      {
        label: "STRATEGY HINTS",
        title: "Know the Route Before You Throw.",
        copy: "See a checkout route for the score and darts you have left, with a plain “Why this route?” explanation. Cricket gets hints too.",
        points: ["Standard or personalized to your drill results", "Set your preferred double", "Turn hints off any time"],
        visual: "hint",
      },
      {
        label: "ALTER EGO",
        title: "Play the Player You Are Right Now.",
        copy: "Alter Ego is an X01 practice opponent that throws like your own recent form. Beat it, and you know you’re improving.",
        points: ["Built from your own recent X01 darts", "Updates as your game changes", "Practice only, so your Elo is safe"],
        visual: "alterego",
      },
    ],
    cta: { label: "YOUR COACH IS READY", title: "Ask Your First Question." },
  },
  {
    slug: "practice",
    nav: "Practice",
    icon: "＋",
    eyebrow: "PRACTICE & BOTS",
    title: ["Put in the Practice.", "Watch It Pay Off."],
    intro: "Focused drills, a ladder of eight bots, and an opponent that plays like you. Practice is logged on its own and never touches your competitive record.",
    card: "Bob’s 27, checkout and scoring drills, and eight bot opponents from Rook to Blackbird.",
    description: "Practice darts with Bob’s 27, checkout and scoring drills, and eight bot opponents. Practice is logged separately from your competitive Elo.",
    rows: [
      {
        label: "DRILLS",
        title: "Three Drills. No Excuses.",
        copy: "Work your doubles with Bob’s 27, finish more with checkout drills, and push your scoring on 20, 19, 18, or the bull.",
        points: ["Bob’s 27 for doubles", "Checkout drills: 5, 10, or 20 finishes", "Scoring drills on 20, 19, 18, or the bull"],
        visual: "drills",
      },
      {
        label: "THE BOT LADDER",
        title: "Eight Opponents. One to Beat.",
        copy: "Start with Rook, who is still finding the 20, and climb to Blackbird, who averages a ton. Each bot throws like a real player at its level.",
        points: ["From a 32 to a 100 average", "Beat a bot to face the next", "Play them at X01 or Cricket"],
        visual: "bots",
      },
      {
        label: "ALTER EGO",
        title: "Your Toughest Rival Is You.",
        copy: "Alter Ego plays at your own recent level, so every win means something. It’s part of Blackbird’s coaching tools.",
        points: ["Matches your recent X01 form", "Never learns from its own games", "Practice only"],
        visual: "alterego",
        link: { href: "/features/coaching", text: "More about coaching" },
      },
    ],
    cta: { label: "ONE MORE ROUND", title: "The Board Is Waiting." },
  },
  {
    slug: "stats",
    nav: "Stats & Social",
    icon: "⌁",
    eyebrow: "STATS, RIVALRIES & ACHIEVEMENTS",
    title: ["Get to Know Your Game.", "Keep the Rivalry Going."],
    intro: "Averages, checkouts, and Cricket MPR over any date range. Elo ratings, head-to-head records, badges to chase, and a player card to show off.",
    card: "Stats over any date range, Elo and matchups, dozens of badges, and a shareable player card.",
    description: "Dart stats over any date range, Elo ratings and head-to-head matchups, dozens of achievements, profile covers and a shareable player card.",
    rows: [
      {
        label: "PLAYER STATS",
        title: "See the Progress Behind the Score.",
        copy: "Your three-dart average, checkout rate, best finishes, and Cricket MPR, for every game type. Pick a date range and tap any chart to read it.",
        points: ["Stats for all nine game modes", "Any date range", "Records and career cards"],
        visual: "stats",
      },
      {
        label: "MATCHUP",
        title: "The Tale of the Tape.",
        copy: "Put two players side by side. See each one’s Elo, the win chance it predicts, their numbers compared, and how the last five meetings went.",
        points: ["Elo ratings and a leaderboard", "Win chance from Elo", "Last five meetings"],
        visual: "matchup",
      },
      {
        label: "ACHIEVEMENTS",
        title: "Something to Chase Every Night.",
        copy: "Earn badges for milestones, big scores, finishes, Cricket, streaks, and more. Some are easy. Some will take a season.",
        points: ["Dozens of badges with progress bars", "Streak badges for regular play", "Profile badges"],
        visual: "badges",
      },
      {
        label: "PROFILES & FRIENDS",
        title: "Make It Yours. Share It.",
        copy: "Pick a colour, a profile cover, and a name tag. Follow friends, and export a player card with a QR code that brings them to Blackbird.",
        points: ["Profile covers and name tags", "Follow friends by name or @handle", "Shareable player card"],
        visual: "card",
      },
    ],
    cta: { label: "BRAGGING RIGHTS", title: "Settle It at the Board." },
  },
];

export function featurePage(slug) {
  return FEATURE_PAGES.find((p) => p.slug === slug) || null;
}
