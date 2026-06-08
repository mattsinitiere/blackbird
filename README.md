# Blackbird Dart Scoring System

Score **501 / 301 / 701** and **Cricket**, track players, see leaderboards,
profiles, and an Elo matchup predictor, and generate **AI insights** about your
league. Built with Next.js + Supabase. Logins keep it private; stats live in
Postgres and sync across everyone's phones. No localStorage for data.

## Stack
- **Next.js (App Router)** on Vercel — includes one serverless API route.
- **Supabase** — Postgres database + email/password auth.
- **AI Insights** — server-side call to the provider you choose (free or paid).

---

# Deploy, start to finish

## 1. Code → GitHub
```bash
unzip blackbird-dart-scoring-system.zip && cd blackbird
git init && git add . && git commit -m "Blackbird Dart Scoring System"
git remote add origin https://github.com/YOU/blackbird.git
git branch -M main && git push -u origin main
```

## 2. Supabase (database + login)
1. https://supabase.com → **New project** (set + save a DB password). Wait ~1 min.
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
3. **Settings → API** → copy **Project URL** and the **anon public** key.
4. **Authentication → Providers → Email**: enabled. Turn **OFF** "Confirm email"
   so accounts work instantly (no email link to tap on a phone).
5. After everyone has signed up, turn **OFF** "Allow new users to sign up" to
   lock it to your group.

## 3. Pick an AI provider for the Insights tab
Choose ONE and get a key:

| Provider | Cost | Get a key | Default model |
|----------|------|-----------|---------------|
| **Gemini** | Free | https://aistudio.google.com/apikey | `gemini-2.5-flash` |
| **Groq** | Free | https://console.groq.com/keys | `llama-3.3-70b-versatile` |
| **OpenAI** | Paid | https://platform.openai.com/api-keys | `gpt-4o-mini` |
| **Anthropic** | Paid | https://console.anthropic.com | `claude-3-5-haiku-latest` |

Gemini is the easy free pick (no credit card; ~1,500 requests/day — far more
than a darts league needs). Model names drift; if a default ever errors, set
`AI_MODEL` to a current one (e.g. a newer Gemini Flash).

## 4. Run locally (optional)
```bash
cp .env.example .env.local   # fill in Supabase values + AI_PROVIDER + the key
npm install
npm run dev                  # http://localhost:3000
```

## 5. Deploy to Vercel
1. https://vercel.com → **Add New → Project** → import your repo.
2. Add **Environment Variables** (Settings → Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `AI_PROVIDER` (e.g. `gemini`)
   - the key for that provider (e.g. `GEMINI_API_KEY`)
   - optionally `AI_MODEL`
3. **Deploy.** You get `https://….vercel.app`. Every `git push` redeploys.
4. Supabase → **Authentication → URL Configuration** → set **Site URL** to your
   Vercel URL (only needed if you left email confirmation on).

> Why Vercel and not GitHub Pages now: the AI key must stay secret, so the AI
> call runs in a serverless route (`app/api/insights/route.js`). That needs a
> host that runs Next.js server code. GitHub still holds your source.

## 6. On phones
Open the Vercel URL, sign in. iPhone Safari → Share → **Add to Home Screen**;
Android Chrome → menu → **Add to home screen**. Data syncs via Supabase; the app
refreshes on reopen, and the ↻ button forces a refresh.

---

## Security notes (worth understanding)
- The **Supabase anon key** is meant to be public; Row Level Security in
  `schema.sql` is what protects your data. Never deploy the Supabase
  **service_role** key — you don't need it.
- The **AI key** is a real secret. It is set without a `NEXT_PUBLIC_` prefix, so
  it stays on the server and never reaches the browser. The `/api/insights` route
  also verifies a valid login before calling the model, so a stranger who finds
  the URL can't burn your AI quota.

## "No localStorage"
Your darts data lives entirely in Postgres — none of it touches localStorage.
The only thing in localStorage is Supabase's login session token, which keeps you
signed in between visits. To disable even that, create the client with
`auth: { persistSession: false }` in `lib/supabase.js` — but then you re-login on
every refresh, which is rough on phones. Recommended: leave it on.

## Known limitations (by design)
- Double-out is trusted, not verified (you enter a 3-dart total).
- "Accuracy" = 3-dart average; no intended-target tracking.
- One leg per match.
- Multiplayer Elo updates the winner pairwise; losers aren't ranked vs each other.
- AI insights reflect only the stats in your database; with few games they're thin.

## Project structure
```
app/
  layout.js, page.js (app + auth gate + nav), globals.css
  api/insights/route.js   server-side AI call (secret key lives here)
components/
  Auth.js, Insights.js + screens (Home, Setup, PlayX01, PlayCricket, ...)
lib/
  supabase.js (client), db.js (queries), stats.js (Elo), constants.js
supabase/
  schema.sql   run this in Supabase
```

## License
MIT.
# blackbird
