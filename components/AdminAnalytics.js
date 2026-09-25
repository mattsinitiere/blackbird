import { useEffect, useState } from "react";
import { callAdmin } from "@/lib/adminClient";
import { BarChart, StatCards } from "./Charts";
import { RANGES } from "@/lib/adminAnalytics";

const n = (v) => (v == null ? "–" : Number(v).toLocaleString("en-US"));
const usd = (v) => (v == null ? "–" : `$${v < 1 ? v.toFixed(3) : v.toFixed(2)}`);
const MODE_NAMES = { x01: "X01", cricket: "Cricket", baseball: "Baseball", aroundTheClock: "Around the Clock", killer: "Killer", shanghai: "Shanghai", halveit: "Halve It", gotcha: "Gotcha", tictactoe: "Tic-Tac-Toe", bobs27: "Bob's 27", checkoutDrill: "Checkout Drill", scoringDrill: "Scoring Drill" };

function Section({ title, children, note }) {
  return (
    <section className="card mb-12 an-section">
      <h3 className="section-title">{title}</h3>
      {children}
      {note && <p className="an-note">{note}</p>}
    </section>
  );
}

/**
 * Admin → Analytics: sign-ups, activity, games, AI usage and cost, and
 * training, for a chosen period. Numbers come from /api/admin
 * (action "analytics", lib/adminAnalytics.js), read with the service role.
 */
export default function AdminAnalytics() {
  const [range, setRange] = useState("30d");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr("");
    callAdmin({ action: "analytics", range })
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setErr(e.message || "Couldn't load analytics."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range]);

  const d = data;
  const per = d ? { day: "per day", week: "per week", month: "per month" }[d.range.bucket] : "";
  return (
    <div aria-busy={loading}>
      <div className="plan-choice mb-12" role="radiogroup" aria-label="Period">
        {RANGES.map((r) => (
          <button key={r.id} type="button" role="radio" aria-checked={range === r.id} className={`plan-chip${range === r.id ? " is-on" : ""}`} onClick={() => setRange(r.id)}>
            {r.label}
          </button>
        ))}
      </div>
      {err && (
        <div className="card mb-12" style={{ borderColor: "var(--red)" }}>
          <p className="subtle" style={{ margin: 0, color: "var(--red)" }}>{err}</p>
        </div>
      )}
      {!d && loading && <p className="tag plans-note">Loading analytics…</p>}
      {d && (
        <>
          <Section title="Users" note={`Sign-ups ${per}. Times in ${d.range.tz}.`}>
            <StatCards
              items={[
                { label: "Accounts", value: n(d.signups.total) },
                { label: `New (${d.range.label})`, value: n(d.signups.inRange) },
                { label: "Active", value: n(d.active.users) },
                { label: "Played a game", value: n(d.active.played) },
              ]}
            />
            <BarChart data={d.signups.series} />
          </Section>

          <Section title="Daily Visitors" note={`Accounts that opened the app, ${per}.`}>
            <BarChart data={d.active.series} />
          </Section>

          <Section title="Games" note="Distinct games (one per game, not per player).">
            <StatCards
              items={[
                { label: "Games", value: n(d.games.games) },
                { label: "Ranked", value: n(d.games.ranked) },
                { label: "Practice", value: n(d.games.practice) },
              ]}
            />
            <BarChart data={d.games.series} />
            {Object.keys(d.games.byMode).length > 0 && (
              <div className="an-modes">
                {Object.entries(d.games.byMode)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <span key={k} className="mu-mode">
                      {MODE_NAMES[k] || k} <b className="num">{v}</b>
                    </span>
                  ))}
              </div>
            )}
          </Section>

          <Section
            title="AI Usage & Cost"
            note={
              d.ai
                ? `${d.ai.models.join(", ") || "No model recorded"}${d.ai.efforts.length ? ` · effort ${d.ai.efforts.join(", ")}` : ""}. ${d.ai.cost ? "Cost is an estimate from the token prices set on the server." : "Set AI_PRICE_INPUT_PER_1M and AI_PRICE_OUTPUT_PER_1M on the server to estimate cost."}${d.ai.tokensCoverage != null && d.ai.tokensCoverage < 1 ? ` Token counts were reported for ${Math.round(d.ai.tokensCoverage * 100)}% of requests.` : ""}`
                : "The AI request log isn't set up yet (supabase/migration-ai-log.sql). Showing daily request counts only."
            }
          >
            {d.ai ? (
              <>
                <StatCards
                  items={[
                    { label: "Requests", value: n(d.ai.requests) },
                    { label: "Est. cost", value: d.ai.cost ? usd(d.ai.cost.total) : "Not set" },
                    { label: "Tokens in / out", value: `${n(d.ai.tokensIn)} / ${n(d.ai.tokensOut)}` },
                    { label: "Avg time", value: d.ai.avgMs != null ? `${(d.ai.avgMs / 1000).toFixed(1)}s` : "–" },
                  ]}
                />
                <BarChart data={d.ai.series} />
                <div className="an-grid">
                  <div>
                    <div className="an-sub">By kind</div>
                    {Object.entries(d.ai.byKind).map(([k, v]) => (
                      <div key={k} className="an-row">
                        <span>{{ chat: "Chat", game: "Match reports", weekly: "Weekly reports", plan: "Plan drafts", identity: "Identity replies" }[k] || k}</span>
                        <b className="num">{n(v)}</b>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="an-sub">Health</div>
                    <div className="an-row"><span>Errors</span><b className="num">{n(d.ai.errors)}</b></div>
                    <div className="an-row"><span>Hit daily limit</span><b className="num">{n(d.ai.limited)}</b></div>
                    <div className="an-row"><span>Fallbacks</span><b className="num">{n(d.ai.fallbacks)}</b></div>
                    <div className="an-row"><span>Summary-only answers</span><b className="num">{n(d.ai.summaryOnly)}</b></div>
                  </div>
                  <div>
                    <div className="an-sub">Top users</div>
                    {d.ai.topUsers.length === 0 && <div className="an-row"><span>None yet</span></div>}
                    {d.ai.topUsers.map((u) => (
                      <div key={u.name} className="an-row">
                        <span>{u.name}</span>
                        <b className="num">{n(u.requests)}</b>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <StatCards items={[{ label: "Requests (daily counter)", value: n(d.allowance.requests) }]} />
                <BarChart data={d.allowance.series} />
              </>
            )}
          </Section>

          <Section title="Training" note={d.training.plans == null ? "Training plans aren't set up yet (supabase/migration-training-plans.sql)." : "Saved plans right now; completions and Alter Ego games in the period."}>
            <StatCards
              items={[
                { label: "Saved plans", value: n(d.training.plans) },
                { label: "By Merlin / custom", value: d.training.plans == null ? "–" : `${n(d.training.ai)} / ${n(d.training.custom)}` },
                { label: "Drills completed", value: n(d.training.completions) },
                { label: "Alter Ego games", value: n(d.training.alterEgoGames) },
              ]}
            />
          </Section>
          {d.coverage?.games?.status === "partial" && <p className="an-note">Game counts are incomplete: {d.coverage.games.reason}.</p>}
        </>
      )}
    </div>
  );
}
