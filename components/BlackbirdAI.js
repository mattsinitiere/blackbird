import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { headToHead } from "@/lib/stats";
import { computePractice } from "@/lib/practice";
import { BASE_ELO } from "@/lib/constants";
import { PlayerBadge } from "./ui";

const SUGGESTIONS = [
  "How's my form lately?",
  "What should I practice this week?",
  "Who is my toughest rival?",
  "What was my best game this month?",
  "How is my checkout percentage trending?",
];

function round(n, d = 0) {
  const f = Math.pow(10, d);
  return Math.round((n || 0) * f) / f;
}

/** Everything the coach may cite about one player, compact enough to send each turn. */
function buildMySummary({ me, stats, elo, results, practice, players }) {
  const s = stats[me];
  const ranked = players
    .filter((p) => !p.hidden && stats[p.username])
    .map((p) => p.username)
    .sort((a, b) => (elo[b] || BASE_ELO) - (elo[a] || BASE_ELO));
  const mine = (results || [])
    .filter((r) => r.username === me && r.result !== "practice")
    .sort((a, b) => new Date(a.completedAt) - new Date(b.completedAt));
  const opponents = {};
  for (const r of mine) for (const o of r.opponents || []) opponents[o] = true;
  const rivals = Object.keys(opponents).map((o) => {
    const h = headToHead(results, me, o);
    return { opponent: o, wins: h.aw, losses: h.bw, games: h.n, opponentElo: Math.round(elo[o] || BASE_ELO) };
  });
  const recent = mine.slice(-60).map((r) => ({
    date: r.completedAt,
    game: r.gameType,
    config: r.config,
    result: r.result,
    winner: r.winner,
    opponents: r.opponents,
    stats: r.stats,
  }));
  const pr = computePractice(practice || [], me);
  const drills = Object.fromEntries(
    Object.entries(pr.drills).map(([k, d]) => [k, { label: d.label, sessions: d.count, personalBest: d.pb ? { value: d.pb.value, date: d.pb.date } : null }])
  );
  return {
    me: s
      ? {
          name: me,
          elo: Math.round(elo[me] || BASE_ELO),
          rank: ranked.indexOf(me) + 1,
          leagueSize: ranked.length,
          games: s.games,
          wins: s.wins,
          winPct: round(s.winPct),
          currentWinStreak: s.winStreak,
          bestWinStreak: s.bestStreak,
          x01: { games: s.x01.games, wins: s.x01.wins, threeDartAvg: round(s.x01.threeDartAvg, 1), first9Avg: round(s.x01.first9Avg, 1), highestTurn: s.x01.highestTurn, highestCheckout: s.x01.highestCheckout, bestLeg: s.x01.bestLeg },
          cricket: { games: s.cricket.games, wins: s.cricket.wins, mpr: round(s.cricket.mpr, 2), bestMpr: round(s.cricket.bestMpr, 2) },
          baseball: { games: s.baseball.games, wins: s.baseball.wins, runs: s.baseball.runs },
        }
      : { name: me, games: 0 },
    headToHead: rivals,
    recentGames: recent,
    practice: {
      sessions: pr.count,
      thisWeek: pr.thisWeek,
      drills,
      soloX01: { sessions: pr.x01.count, bestAvg: pr.x01.bestAvg },
      bots: { games: pr.bots.games, wins: pr.bots.wins, ladderLevel: pr.bots.level },
    },
    today: new Date().toISOString(),
  };
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </svg>
  );
}

function BirdAvatar() {
  return (
    <span className="ai-avatar" aria-hidden="true">
      <img className="logo-color" src="/brand/icon-color.svg" alt="" />
      <img className="logo-white" src="/brand/icon-white.svg" alt="" />
    </span>
  );
}

/**
 * Blackbird AI: a chat about the signed-in player's own games. Every turn
 * sends the player's summary plus the last few messages to /api/insights,
 * so follow-up questions keep their context. The conversation is kept per
 * account in localStorage so it survives a reload.
 */
export default function BlackbirdAI({ me, userId, stats, elo, results, practice, players, playerColors }) {
  const storageKey = `bb-ai-chat-${userId || "anon"}`;
  const [messages, setMessages] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setMessages(JSON.parse(raw).slice(-40));
    } catch {}
    setLoaded(true);
  }, [storageKey]);
  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(messages.slice(-40)));
    } catch {}
  }, [messages, loaded, storageKey]);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);
  useEffect(scrollToBottom, [messages, busy, scrollToBottom]);

  const summary = useMemo(() => buildMySummary({ me, stats, elo, results, practice, players }), [me, stats, elo, results, practice, players]);
  const hasData = (summary.me.games || 0) + summary.practice.sessions > 0;

  const send = async (text) => {
    const q = text.trim();
    if (!q || busy) return;
    const id = Date.now();
    const history = messages.filter((m) => !m.error).slice(-8).map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, { id, role: "user", content: q }]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data?.session?.access_token || ""}` },
        body: JSON.stringify({ kind: "me", question: q, history, summary }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Request failed");
      setMessages((prev) => [...prev, { id: id + 1, role: "assistant", content: body.text }]);
    } catch (e) {
      setMessages((prev) => [...prev, { id: id + 1, role: "assistant", content: e.message || "Something went wrong.", error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };
  const onChange = (e) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const empty = messages.length === 0 && !busy;

  return (
    <div className="ai-chat fade">
      <div className="ai-head">
        <BirdAvatar />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="display" style={{ fontSize: "calc(18px * var(--fs))" }}>Blackbird AI</div>
          <div className="tag" style={{ textTransform: "none", letterSpacing: 0, marginTop: 2 }}>Your games, your stats, your coach.</div>
        </div>
        {messages.length > 0 && (
          <button className="btn btn-sm" onClick={() => setMessages([])} disabled={busy}>
            New chat
          </button>
        )}
      </div>

      <div className="ai-messages" ref={listRef} aria-live="polite">
        {empty && (
          <div className="ai-empty">
            {hasData ? (
              <p className="subtle" style={{ margin: "0 0 16px" }}>
                Ask about your form, records, rivals or practice. Answers use only your logged games.
              </p>
            ) : (
              <p className="subtle" style={{ margin: "0 0 16px" }}>
                Play or practice a few games first. Blackbird AI only talks about games you have actually logged.
              </p>
            )}
            <div className="ai-suggestions">
              {SUGGESTIONS.map((q) => (
                <button key={q} className="chip ai-suggestion" type="button" onClick={() => send(q)} disabled={!hasData}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`ai-row ${m.role === "user" ? "is-user" : "is-bot"}${m.error ? " is-error" : ""}`}>
            {m.role === "assistant" ? <BirdAvatar /> : <PlayerBadge username={me || "?"} color={playerColors?.[me]} size={26} showName={false} />}
            <div className="ai-bubble">{m.content}</div>
          </div>
        ))}

        {busy && (
          <div className="ai-row is-bot">
            <BirdAvatar />
            <div className="ai-bubble">
              <div className="typing-dots">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}
      </div>

      <form
        className="ai-compose"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          ref={inputRef}
          className="input ai-input"
          value={input}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={hasData ? "Ask about your games…" : "Log a game first…"}
          rows={1}
          disabled={busy || !hasData}
          aria-label="Ask Blackbird AI"
        />
        <button className="btn btn-primary ai-send" type="submit" disabled={busy || !hasData || !input.trim()} aria-label="Send">
          <SendIcon />
        </button>
      </form>
    </div>
  );
}
