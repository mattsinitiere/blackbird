import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { buildMySummary } from "@/lib/aiSummary";
import AIChart, { chartsOf } from "./AIChart";
import { PlayerBadge } from "./ui";

const SUGGESTIONS = [
  "Analyze my last game",
  "Where do my darts land in X01?",
  "Compare my 3-dart average with my top rival by month",
  "Break down my wins by game mode",
  "How is my checkout percentage trending?",
  "What should I practice this week?",
];

const DAY_MS = 86400000;
/** The Monday that starts this week, as YYYY-MM-DD (the weekly report's cache key). */
function weekKey(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
 * sends the player's summary (lib/aiSummary.js) plus the last few messages
 * to /api/insights, so follow-up questions keep their context. A reply may
 * carry a chart resolved from the summary's own series (lib/aiChart.js).
 * The conversation is kept per account in localStorage so it survives a
 * reload.
 */
export default function BlackbirdAI({ me, userId, stats, elo, results, practice, players, social, playerColors }) {
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

  const summary = useMemo(() => buildMySummary({ me, stats, elo, results, practice, players, social }), [me, stats, elo, results, practice, players, social]);
  const hasData = (summary.me.games || 0) + summary.practice.sessions > 0;

  // this week's report card: generated once a week (per phone), only when
  // there are ranked games in the last 7 days
  const [weekly, setWeekly] = useState(null);
  const [weeklyOpen, setWeeklyOpen] = useState(true);
  const playedThisWeek = useMemo(
    () => (results || []).some((r) => r.username === me && r.result !== "practice" && Date.now() - new Date(r.completedAt).getTime() <= 7 * DAY_MS),
    [results, me]
  );
  useEffect(() => {
    if (!loaded || !me || !playedThisWeek) return;
    const key = `bb-ai-weekly-${userId || "anon"}-${weekKey()}`;
    try {
      const cached = JSON.parse(window.localStorage.getItem(key) || "null");
      if (cached) {
        setWeekly(cached);
        return;
      }
    } catch {}
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const res = await fetch("/api/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${data?.session?.access_token || ""}` },
          body: JSON.stringify({ kind: "weekly", me }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || cancelled) return; // quietly try again next visit
        const report = body.empty ? { empty: true } : { text: body.text, charts: body.charts || [], from: body.from, to: body.to };
        try {
          window.localStorage.setItem(key, JSON.stringify(report));
        } catch {}
        setWeekly(report);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [loaded, me, userId, playedThisWeek]);

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
        body: JSON.stringify({ kind: "me", question: q, history, summary, me }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Request failed");
      const charts = Array.isArray(body.charts) ? body.charts.slice(0, 3) : body.chart ? [body.chart] : [];
      setMessages((prev) => [...prev, { id: id + 1, role: "assistant", content: body.text, charts }]);
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
        {weekly && !weekly.empty && weekly.text && (
          <section className="ai-weekly" aria-label="Your week in darts">
            <div className="ai-weekly-head">
              <span className="ai-weekly-title">Your Week in Darts</span>
              <button type="button" className="btn btn-sm" onClick={() => setWeeklyOpen((o) => !o)} aria-expanded={weeklyOpen}>
                {weeklyOpen ? "Hide" : "Show"}
              </button>
            </div>
            {weeklyOpen && (
              <>
                <div className="ai-text">{weekly.text}</div>
                {(weekly.charts || []).map((c, i) => (
                  <AIChart key={i} chart={c} />
                ))}
              </>
            )}
          </section>
        )}
        {empty && (
          <div className="ai-empty">
            {hasData ? (
              <p className="subtle" style={{ margin: "0 0 16px" }}>
                Ask about your form, checkouts, records, rivals or practice, or ask for a chart. Answers use only your logged games.
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
            <div className={`ai-bubble${chartsOf(m).length ? " has-chart" : ""}`}>
              <div className="ai-text">{m.content}</div>
              {chartsOf(m).map((c, i) => (
                <AIChart key={i} chart={c} />
              ))}
            </div>
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
