import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { buildMySummary } from "@/lib/aiSummary";
import AIChart, { chartsOf } from "./AIChart";
import AIText from "./AIText";
import { visibleWhileStreaming } from "@/lib/aiBlocks";
import { computeAchievements } from "@/lib/achievements";
import { ANSWER_STYLES, DEFAULT_STYLE } from "@/lib/answerStyle";
import { PlayerBadge } from "./ui";

const SUGGESTIONS = [
  "Analyze my last game",
  "Show a heatmap of my darts in X01",
  "Compare my 3-dart average with my top rival by month",
  "Break down my wins by game mode",
  "How is my checkout percentage trending?",
  "Build me a training plan",
  "Which achievements am I closest to?",
];

const DAY_MS = 86400000;
/** The Monday that starts this week, as YYYY-MM-DD (the weekly report's cache key). */
function weekKey(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** New chat: a speech bubble with a plus. */
function NewChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8z" />
      <path d="M12 6.5v6M9 9.5h6" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </svg>
  );
}

/**
 * Answer Style (lib/answerStyle.js): how long the reply is. Presentation
 * only. Every style runs the same model with the same fixed reasoning
 * effort, token ceilings and tool budget.
 */
const STYLE_LINES = { brief: 1, balanced: 2, detailed: 3 };

/** Text lines: one for Brief, two for Balanced, three for Detailed. */
function StyleIcon({ style = "balanced", size = 18 }) {
  const n = STYLE_LINES[style] || 2;
  const ys = n === 1 ? [12] : n === 2 ? [9, 15] : [7, 12, 17];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      {ys.map((y, i) => (
        <path key={y} d={`M4 ${y}h${i === ys.length - 1 && n > 1 ? 10 : 16}`} />
      ))}
    </svg>
  );
}

function Chevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/** The Answer Style pill in the input box; opens a small menu above it. */
function StylePicker({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const current = ANSWER_STYLES.find((x) => x.id === value) || ANSWER_STYLES[1];
  useEffect(() => {
    if (!open) return;
    const away = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const esc = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  return (
    <div className="ai-brain" ref={wrapRef}>
      <button type="button" className={`ai-brain-btn${open ? " is-open" : ""}`} aria-haspopup="menu" aria-expanded={open} aria-label={`Answer style: ${current.label}`} onClick={() => setOpen((o) => !o)} disabled={disabled}>
        <StyleIcon style={current.id} size={18} />
        <span>{current.label}</span>
        <Chevron />
      </button>
      {open && (
        <div className="ai-brain-menu" role="menu" aria-label="Answer style">
          <div className="ai-brain-menu-head">Answer Style</div>
          {ANSWER_STYLES.map((b) => (
            <button
              key={b.id}
              type="button"
              role="menuitemradio"
              aria-checked={value === b.id}
              className={`ai-brain-item${value === b.id ? " is-on" : ""}`}
              onClick={() => {
                onChange(b.id);
                setOpen(false);
              }}
            >
              <StyleIcon style={b.id} size={20} />
              <span className="ai-brain-item-text">
                <b>{b.label}</b>
                <small>{b.hint}</small>
              </span>
              {value === b.id && <Check />}
            </button>
          ))}
        </div>
      )}
    </div>
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
export default function BlackbirdAI({ me, userId, stats, elo, results, practice, players, social, playerColors, autoAsk = null, onAutoAsked = null, onAction = null }) {
  const storageKey = `bb-ai-chat-${userId || "anon"}`;
  const [messages, setMessages] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setMessages(JSON.parse(raw).slice(-40).map((m) => (m.streaming ? { ...m, streaming: false, steps: undefined } : m)));
    } catch {}
    setLoaded(true);
  }, [storageKey]);
  // every visit starts at Balanced; a pick lasts while the tab is open
  const pickStyle = (v) => setStyle(v);
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
  // the player's badges, for the medals the AI can show in a reply
  const badges = useMemo(() => {
    try {
      return computeAchievements({ me, results, practice, social });
    } catch {
      return [];
    }
  }, [me, results, practice, social]);

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
        const { data } = supabase ? await supabase.auth.getSession() : { data: null };
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

  // requests left today (shown when it gets low); null = unknown or unlimited
  const [left, setLeft] = useState(null);
  const abortRef = useRef(null);
  const patch = (id, fn) => setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...fn(m) } : m)));

  const send = async (text) => {
    const q = text.trim();
    if (!q || busy) return;
    const id = Date.now();
    const aid = id + 1;
    const history = messages.filter((m) => !m.error && m.content).slice(-8).map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, { id, role: "user", content: q }, { id: aid, role: "assistant", content: "", streaming: true, steps: [] }]);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const { data } = supabase ? await supabase.auth.getSession() : { data: null };
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data?.session?.access_token || ""}` },
        body: JSON.stringify({ kind: "me", question: q, history, style }),
        signal: ctrl.signal,
      });
      if (!res.ok || !(res.headers.get("content-type") || "").includes("ndjson")) {
        const body = await res.json().catch(() => ({}));
        if (body.limit) setLeft(0);
        throw new Error(body.error || "Request failed");
      }
      // the reply streams in: steps, then text, then the finished answer
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf("\n")) !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let ev;
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.type === "status") patch(aid, (m) => ({ steps: [...(m.steps || []), ev.text].slice(-4) }));
          else if (ev.type === "delta") patch(aid, (m) => ({ content: (m.content || "") + ev.text }));
          else if (ev.type === "reset") patch(aid, () => ({ content: "" }));
          else if (ev.type === "done") {
            finished = true;
            if (ev.left !== undefined) setLeft(ev.left);
            patch(aid, () => ({ content: ev.text, charts: (ev.charts || []).slice(0, 3), followups: ev.followups || [], actions: ev.actions || [], via: ev.via || null, coverage: ev.coverage || null, streaming: false, steps: undefined }));
          } else if (ev.type === "error") {
            finished = true;
            patch(aid, () => ({ content: ev.error || "Something went wrong.", error: true, streaming: false, steps: undefined }));
          }
        }
      }
      if (!finished) patch(aid, (m) => ({ streaming: false, steps: undefined, error: !m.content, content: m.content || "The answer was cut off. Try again." }));
    } catch (e) {
      if (e?.name === "AbortError") {
        patch(aid, (m) => ({ streaming: false, steps: undefined, stopped: true, content: visibleWhileStreaming(m.content) }));
      } else {
        patch(aid, () => ({ content: e.message || "Something went wrong.", error: true, streaming: false, steps: undefined }));
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };
  const stop = () => abortRef.current?.abort();

  // opened from elsewhere with a question ("Scout This Matchup", ...): sent
  // once. The page clears the request once it's sent, and the id is also
  // remembered for the tab's session, so leaving the chat and coming back
  // (which remounts this component) never asks it again.
  const askedRef = useRef(null);
  useEffect(() => {
    if (!loaded || !autoAsk?.question || askedRef.current === autoAsk.id || busy) return;
    askedRef.current = autoAsk.id;
    const seenKey = "bb-ai-asked";
    let seen = null;
    try {
      seen = window.sessionStorage.getItem(seenKey);
      window.sessionStorage.setItem(seenKey, String(autoAsk.id));
    } catch {}
    onAutoAsked?.(autoAsk.id);
    if (seen === String(autoAsk.id)) return;
    send(autoAsk.question);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, autoAsk]);

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
          <div className="display" style={{ fontSize: "calc(18px * var(--fs))" }}>Merlin</div>
          <div className="tag" style={{ textTransform: "none", letterSpacing: 0, marginTop: 2 }}>Your Blackbird Coach</div>
        </div>
        {messages.length > 0 && (
          <button className="btn ai-new-chat" onClick={() => setMessages([])} disabled={busy} aria-label="New chat" title="New chat">
            <NewChatIcon />
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
                <AIText text={weekly.text} />
                {(weekly.charts || []).map((c, i) => (
                  <AIChart key={i} chart={c} badges={badges} me={me} colors={playerColors} />
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
                Play or practice a few games first. Merlin only talks about games you have actually logged.
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

        {messages.map((m, idx) => {
          const isLast = idx === messages.length - 1;
          const live = m.role === "assistant" && m.streaming;
          const shown = live ? visibleWhileStreaming(m.content) : m.content;
          return (
            <div key={m.id} className={`ai-row ${m.role === "user" ? "is-user" : "is-bot"}${m.error ? " is-error" : ""}`}>
              {m.role === "assistant" ? <BirdAvatar /> : <PlayerBadge username={me || "?"} color={playerColors?.[me]} size={26} showName={false} />}
              <div className={`ai-bubble${chartsOf(m).length ? " has-chart" : ""}`}>
                {live && (m.steps || []).length > 0 && (
                  <ul className="ai-steps" aria-live="polite">
                    {m.steps.map((st, i) => (
                      <li key={i} className={i === m.steps.length - 1 && !shown ? "is-now" : ""}>
                        {st}
                      </li>
                    ))}
                  </ul>
                )}
                {live && !shown && !(m.steps || []).length && (
                  <div className="typing-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                )}
                {shown ? m.role === "assistant" && !m.error ? <AIText text={shown} /> : <div className="ai-text">{shown}</div> : null}
                {live && shown && <span className="ai-caret" aria-hidden="true" />}
                {m.stopped && <div className="ai-stopped">Stopped</div>}
                {!live && m.via === "plain" && <div className="ai-note">Answered from your headline stats only; the detailed game analysis wasn't available this time.</div>}
                {!live && m.via === "tools" && m.coverage && <div className="ai-note">Based on {m.coverage}.</div>}
                {chartsOf(m).map((c, i) => (
                  <AIChart key={i} chart={c} badges={badges} me={me} colors={playerColors} />
                ))}
                {!live && (m.actions || []).length > 0 && (
                  <div className="ai-actions">
                    {m.actions.map((a, i) => (
                      <button key={i} type="button" className="btn btn-primary ai-action" onClick={() => onAction?.(a)} disabled={!onAction}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {isLast && !busy && (m.followups || []).length > 0 && (
                <div className="ai-followups">
                  {m.followups.map((q) => (
                    <button key={q} type="button" className="chip ai-followup" onClick={() => send(q)}>
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {left != null && left <= 10 && (
        <div className="ai-left" role="status">
          {left > 0 ? `${left} AI ${left === 1 ? "request" : "requests"} left today` : "No AI requests left today. They reset at midnight (Central)."}
        </div>
      )}
      <form
        className="ai-compose"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className={`ai-box${busy || !hasData ? " is-disabled" : ""}`}>
          <textarea
            ref={inputRef}
            className="ai-input"
            value={input}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder={hasData ? "Ask about your games…" : "Log a game first…"}
            rows={1}
            disabled={busy || !hasData}
            aria-label="Ask Merlin"
            onBlur={() => {
              // iOS scrolls the page up for the keyboard; put it back so the
              // header and input stay where they belong
              if (typeof window !== "undefined" && window.scrollY) window.scrollTo(0, 0);
            }}
          />
          <div className="ai-box-bar">
            <StylePicker value={style} onChange={pickStyle} disabled={busy} />
            {busy ? (
              <button className="btn ai-send ai-stop" type="button" onClick={stop} aria-label="Stop">
                <StopIcon />
              </button>
            ) : (
              <button className="btn btn-primary ai-send" type="submit" disabled={!hasData || !input.trim()} aria-label="Send">
                <SendIcon />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
