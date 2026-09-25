import { useMemo, useState } from "react";
import { Modal } from "./ui";
import { supabase } from "@/lib/supabase";
import { MERLIN } from "@/lib/merlin";
import { GOALS, SESSION_MINUTES, ITEM_KINDS, MAX_PLANS, LIMIT_MESSAGE, PLAN_BOUNDS, itemLabel, planProgress, validatePlanDefinition, sessionMinutes } from "@/lib/trainingPlans";
import { BOTS } from "@/lib/bots";
import { WINDOW_LABELS } from "@/lib/alterEgo";

/**
 * Training Plans in Practice: up to three saved plans, made by Merlin from
 * the player's own numbers or built by hand. A saved plan can't be edited
 * (delete it and make another); progress is recorded as games are saved.
 */

const newKey = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

async function callPlans(body) {
  const { data } = supabase ? await supabase.auth.getSession() : { data: null };
  const res = await fetch("/api/plans", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data?.session?.access_token || ""}` },
    body: JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(out.error || "Something went wrong."), { errors: out.errors || null, limit: !!out.limit });
  return out;
}

const goalLabel = (id) => GOALS.find((g) => g.id === id)?.label || "Training";
const fmtDay = (iso) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

function ProgressBar({ pct, label }) {
  return (
    <div className="plan-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function TrainingPlans({ state, unlocked = [], alterEgoOk = false, onRefresh, onDelete, onLaunch, liveGame }) {
  const [creating, setCreating] = useState(null); // "merlin" | "builder"
  const [openId, setOpenId] = useState(null);
  const plans = state?.plans;
  const byPlan = useMemo(() => {
    const m = {};
    for (const c of state?.completions || []) (m[c.plan_id] = m[c.plan_id] || []).push(c);
    return m;
  }, [state]);
  const count = plans?.length || 0;
  const atLimit = count >= MAX_PLANS;
  const open = plans?.find((p) => p.id === openId) || null;
  const liveFor = (id) => (liveGame?.config?.plan?.id === id ? liveGame.config.plan : null);

  return (
    <section className="card mb-12 plans" aria-labelledby="plans-title">
      <div className="between plans-head">
        <h3 className="section-title" id="plans-title" style={{ margin: 0 }}>
          Training Plans
        </h3>
        {plans && <span className="plans-count">{count} of {MAX_PLANS} Plans</span>}
      </div>

      {state?.loading && !plans && <p className="tag plans-note">Loading your plans…</p>}
      {state?.error && <p className="plans-error" role="alert">{state.error}</p>}
      {plans === null && !state?.loading && !state?.error && (
        <p className="tag plans-note">Training plans aren't switched on for this app yet.</p>
      )}

      {plans && plans.length === 0 && (
        <p className="tag plans-note">No plans yet. {MERLIN.name} can build one from your games, or you can build your own.</p>
      )}

      {plans && plans.length > 0 && (
        <div className="stack-8 mb-12">
          {plans.map((p) => {
            const def = p.definition;
            const pr = planProgress(def, byPlan[p.id]);
            const live = liveFor(p.id);
            const next = pr.nextSession != null ? def.sessions[pr.nextSession] : null;
            return (
              <div key={p.id} className="plan-card">
                <button type="button" className="plan-card-main" onClick={() => setOpenId(p.id)} aria-label={`${def.title}: ${pr.completeSessions} of ${pr.totalSessions} sessions done. Open plan`}>
                  <div className="plan-card-top">
                    <span className="plan-title">{def.title}</span>
                    <span className="plan-source">{p.source === "ai" ? MERLIN.name : "Custom"}</span>
                  </div>
                  <div className="plan-sub">
                    {goalLabel(def.goal)} · {pr.completed ? "Complete" : `${pr.completeSessions} of ${pr.totalSessions} sessions`}
                  </div>
                  <ProgressBar pct={pr.pct} label={`${def.title} progress`} />
                  {!pr.completed && next && (
                    <div className="plan-next">
                      {live ? "In progress on this device: " : pr.inProgressSession != null ? "Continue: " : "Next: "}
                      {next.title}
                    </div>
                  )}
                </button>
                {!pr.completed && pr.nextSession != null && (
                  <button type="button" className="btn btn-primary btn-sm plan-go" onClick={() => onLaunch(p, pr.nextSession, pr.nextItem)}>
                    {pr.inProgressSession != null || live ? "Continue" : "Start"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {plans && (
        <>
          <div className="plans-actions">
            <button type="button" className="btn btn-primary" disabled={atLimit} onClick={() => setCreating("merlin")}>
              Create With {MERLIN.name}
            </button>
            <button type="button" className="btn" disabled={atLimit} onClick={() => setCreating("builder")}>
              Build My Own
            </button>
          </div>
          {atLimit && <p className="plans-limit" role="status">{LIMIT_MESSAGE}</p>}
        </>
      )}

      {creating === "merlin" && (
        <MerlinCreate
          onClose={() => setCreating(null)}
          onSaved={async () => {
            setCreating(null);
            await onRefresh();
          }}
        />
      )}
      {creating === "builder" && (
        <PlanBuilder
          unlocked={unlocked}
          alterEgoOk={alterEgoOk}
          onClose={() => setCreating(null)}
          onSaved={async () => {
            setCreating(null);
            await onRefresh();
          }}
        />
      )}
      {open && (
        <PlanDetail
          plan={open}
          completions={byPlan[open.id] || []}
          live={liveFor(open.id)}
          onClose={() => setOpenId(null)}
          onLaunch={(s, i) => {
            setOpenId(null);
            onLaunch(open, s, i);
          }}
          onDelete={async () => {
            await onDelete(open.id);
            setOpenId(null);
          }}
        />
      )}
    </section>
  );
}

// ---- plan preview (shared by Merlin's draft and the detail view) --------

function SessionList({ def, progress }) {
  return (
    <ol className="plan-sessions">
      {def.sessions.map((s, si) => {
        const ps = progress?.sessions?.[si];
        return (
          <li key={si} className={ps?.complete ? "is-done" : ps?.started ? "is-started" : ""}>
            <div className="plan-session-head">
              <span className="plan-session-title">{s.title}</span>
              <span className="plan-session-meta">~{sessionMinutes(s)} min{ps ? ` · ${ps.done}/${ps.total}` : ""}</span>
            </div>
            {s.focus && <div className="plan-session-focus">{s.focus}</div>}
            <ul className="plan-items">
              {s.items.map((it, ii) => (
                <li key={ii} className={ps?.items?.[ii] ? "is-done" : ""}>
                  <span className="plan-item-mark" aria-hidden="true">{ps?.items?.[ii] ? "✓" : "•"}</span>
                  {it.label || itemLabel(it)}
                  {ps?.items?.[ii] && <span className="sr-only"> (done)</span>}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

function BaselineLine({ b }) {
  if (!b) return null;
  const bits = [];
  if (b.x01?.avg != null) bits.push(`X01 average ${b.x01.avg} (${b.x01.games} games)`);
  if (b.checkout?.pct != null) bits.push(`checkout ${b.checkout.pct}% (${b.checkout.hits}/${b.checkout.chances} chances)`);
  if (b.bobs27?.avg != null) bits.push(`Bob's 27 average ${b.bobs27.avg} (${b.bobs27.games})`);
  if (b.scoringDrill?.perVisit != null) bits.push(`scoring drill ${b.scoringDrill.perVisit} per visit`);
  if (b.cricket?.mpr != null) bits.push(`cricket MPR ${b.cricket.mpr} (${b.cricket.games})`);
  return <p className="plan-baseline">{bits.length ? `Starting point: ${bits.join(" · ")}.` : "Starting point: not enough recorded games to measure yet."}</p>;
}

// ---- Create With Merlin -------------------------------------------------

function Choice({ options, value, onChange, label }) {
  return (
    <div className="plan-choice" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={`plan-chip${value === o.value ? " is-on" : ""}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function MerlinCreate({ onClose, onSaved }) {
  const [form, setForm] = useState({ goal: "finishing", minutes: 30, perWeek: 3, weeks: 2, note: "" });
  const [draft, setDraft] = useState(null); // { draft, baseline, starter }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [key, setKey] = useState(newKey);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const makeDraft = async () => {
    setBusy(true);
    setErr("");
    try {
      const out = await callPlans({ action: "draft", ...form });
      setDraft(out);
      setKey(newKey()); // a new draft is a new plan request
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    setErr("");
    try {
      await callPlans({ action: "create", requestKey: key, source: draft.starter ? "custom" : "ai", definition: draft.draft });
      await onSaved();
    } catch (e) {
      setErr(e.errors?.length ? `${e.message} ${e.errors.join(" ")}` : e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal>
      <div className="plan-modal">
        <div className="plan-modal-head">
          <div>
            <div className="plan-modal-kicker">{MERLIN.name} · {MERLIN.tagline}</div>
            <h3 className="plan-modal-title">{draft ? draft.draft.title : "Create a Training Plan"}</h3>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>

        {!draft ? (
          <>
            <label className="plan-label">Goal</label>
            <Choice label="Goal" value={form.goal} onChange={set("goal")} options={GOALS.map((g) => ({ value: g.id, label: g.label }))} />
            <label className="plan-label">Time per session</label>
            <Choice label="Minutes per session" value={form.minutes} onChange={set("minutes")} options={SESSION_MINUTES.map((m) => ({ value: m, label: `${m} min` }))} />
            <label className="plan-label">Sessions per week</label>
            <Choice label="Sessions per week" value={form.perWeek} onChange={set("perWeek")} options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))} />
            <label className="plan-label">Length</label>
            <Choice label="Weeks" value={form.weeks} onChange={set("weeks")} options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n} wk` }))} />
            <label className="plan-label" htmlFor="plan-note">Anything to know? (optional)</label>
            <input id="plan-note" className="input" maxLength={140} value={form.note} onChange={(e) => set("note")(e.target.value)} placeholder="e.g. I keep missing D16" />
            <p className="tag plans-note">{MERLIN.name} uses your recorded games to pick the drills. With little history you'll get a short assessment plan instead. Uses one AI request.</p>
            {err && <p className="plans-error" role="alert">{err}</p>}
            <div className="plan-modal-actions">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={makeDraft}>
                {busy ? "Building…" : "Draft My Plan"}
              </button>
            </div>
          </>
        ) : (
          <>
            {draft.starter && <p className="plan-starter">Starter assessment: not enough recorded games yet for a personalised plan.</p>}
            <div className="plan-sub">{goalLabel(draft.draft.goal)} · {draft.draft.weeks} week{draft.draft.weeks > 1 ? "s" : ""} · {draft.draft.sessions.length} sessions</div>
            {draft.draft.why && <p className="plan-why">{draft.draft.why}</p>}
            <BaselineLine b={draft.baseline} />
            <SessionList def={draft.draft} />
            <p className="tag plans-note">Saved plans can't be edited. To change one later, delete it and create another.</p>
            {err && <p className="plans-error" role="alert">{err}</p>}
            <div className="plan-modal-actions">
              <button type="button" className="btn" disabled={busy} onClick={() => setDraft(null)}>
                Adjust
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
                {busy ? "Saving…" : "Save Plan"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ---- Build My Own -------------------------------------------------------

const KIND_OPTIONS = [
  { value: "checkoutDrill", label: "Checkout Drill" },
  { value: "scoringDrill", label: "Scoring Drill" },
  { value: "bobs27", label: "Bob's 27" },
  { value: "x01", label: "Solo X01" },
  { value: "bot", label: "Bot Match" },
  { value: "alterEgo", label: "Alter Ego" },
];

function defaultItem(type, unlocked) {
  const cfg = {};
  for (const [k, opts] of Object.entries(ITEM_KINDS[type].options)) cfg[k] = opts[0];
  if (type === "scoringDrill") cfg.turns = 10;
  if (type === "checkoutDrill") cfg.count = 10;
  if (type === "x01") cfg.startScore = 501;
  if (type === "bot") cfg.bot = unlocked[unlocked.length - 1] || "bot:rook";
  return { type, config: cfg };
}

function optionLabel(type, key, v) {
  if (type === "bot" && key === "bot") return BOTS.find((b) => b.id === v)?.name || v;
  if (type === "alterEgo") return WINDOW_LABELS[v] || v;
  if (key === "doubleOut") return v ? "Double out" : "Straight out";
  if (key === "gameType") return v === "cricket" ? "Cricket" : "X01";
  if (type === "scoringDrill" && key === "target") return v === 25 ? "Bull" : String(v);
  if (key === "count") return `${v} finishes`;
  if (key === "turns") return `${v} turns`;
  return String(v);
}

function PlanBuilder({ unlocked, alterEgoOk, onClose, onSaved }) {
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("finishing");
  const [weeks, setWeeks] = useState(2);
  const [perWeek, setPerWeek] = useState(3);
  const [sessions, setSessions] = useState([{ title: "Session 1", items: [defaultItem("checkoutDrill", unlocked)] }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [key] = useState(newKey);
  const kinds = KIND_OPTIONS.filter((k) => k.value !== "alterEgo" || alterEgoOk);
  const maxSessions = Math.min(PLAN_BOUNDS.sessions[1], weeks * perWeek);

  const upd = (si, fn) => setSessions((ss) => ss.map((s, i) => (i === si ? fn(s) : s)));
  const move = (arr, i, d) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return arr;
    const out = arr.slice();
    [out[i], out[j]] = [out[j], out[i]];
    return out;
  };

  const save = async () => {
    const def = { title: title.trim() || "My Plan", goal, weeks, perWeek, sessions };
    const v = validatePlanDefinition(def);
    if (!v.ok) {
      setErr(v.errors.join(" "));
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await callPlans({ action: "create", requestKey: key, source: "custom", definition: v.plan });
      await onSaved();
    } catch (e) {
      setErr(e.errors?.length ? `${e.message} ${e.errors.join(" ")}` : e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal>
      <div className="plan-modal">
        <div className="plan-modal-head">
          <h3 className="plan-modal-title">Build My Own Plan</h3>
          <button type="button" className="btn btn-sm" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        <label className="plan-label" htmlFor="plan-title">Plan name</label>
        <input id="plan-title" className="input" maxLength={PLAN_BOUNDS.title} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="My Plan" />
        <label className="plan-label">Goal</label>
        <Choice label="Goal" value={goal} onChange={setGoal} options={GOALS.filter((g) => g.id !== "assessment").map((g) => ({ value: g.id, label: g.label }))} />
        <div className="plan-row2">
          <div>
            <label className="plan-label" htmlFor="plan-weeks">Weeks</label>
            <select id="plan-weeks" className="select" value={weeks} onChange={(e) => setWeeks(+e.target.value)}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="plan-label" htmlFor="plan-per">Sessions a week</label>
            <select id="plan-per" className="select" value={perWeek} onChange={(e) => setPerWeek(+e.target.value)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="plan-build-sessions">
          {sessions.map((s, si) => (
            <div key={si} className="plan-build-session">
              <div className="plan-build-head">
                <input className="input input-sm" aria-label={`Session ${si + 1} name`} maxLength={PLAN_BOUNDS.sessionTitle} value={s.title} onChange={(e) => upd(si, (x) => ({ ...x, title: e.target.value }))} />
                <span className="plan-session-meta">~{sessionMinutes(s)} min</span>
                <button type="button" className="btn btn-sm" aria-label={`Move session ${si + 1} up`} disabled={si === 0} onClick={() => setSessions((ss) => move(ss, si, -1))}>↑</button>
                <button type="button" className="btn btn-sm" aria-label={`Remove session ${si + 1}`} disabled={sessions.length === 1} onClick={() => setSessions((ss) => ss.filter((_, i) => i !== si))}>✕</button>
              </div>
              {s.items.map((it, ii) => (
                <div key={ii} className="plan-build-item">
                  <div className="plan-build-item-top">
                    <select className="select" aria-label={`Drill ${ii + 1}`} value={it.type} onChange={(e) => upd(si, (x) => ({ ...x, items: x.items.map((y, j) => (j === ii ? defaultItem(e.target.value, unlocked) : y)) }))}>
                      {kinds.map((k) => (
                        <option key={k.value} value={k.value}>{k.label}</option>
                      ))}
                    </select>
                    <button type="button" className="btn btn-sm" aria-label={`Move drill ${ii + 1} up`} disabled={ii === 0} onClick={() => upd(si, (x) => ({ ...x, items: move(x.items, ii, -1) }))}>↑</button>
                    <button type="button" className="btn btn-sm" aria-label={`Remove drill ${ii + 1}`} disabled={s.items.length === 1} onClick={() => upd(si, (x) => ({ ...x, items: x.items.filter((_, j) => j !== ii) }))}>✕</button>
                  </div>
                  {Object.keys(ITEM_KINDS[it.type].options).length > 0 && (
                    <div className="plan-build-opts">
                      {Object.entries(ITEM_KINDS[it.type].options).map(([k, opts]) => {
                        const choices = it.type === "bot" && k === "bot" ? opts.filter((o) => unlocked.includes(o)) : opts;
                        return (
                          <select key={k} className="select" aria-label={k} value={String(it.config[k])} onChange={(e) => {
                            const raw = e.target.value;
                            const v = choices.find((o) => String(o) === raw);
                            upd(si, (x) => ({ ...x, items: x.items.map((y, j) => (j === ii ? { ...y, config: { ...y.config, [k]: v } } : y)) }));
                          }}>
                            {choices.map((o) => (
                              <option key={String(o)} value={String(o)}>{optionLabel(it.type, k, o)}</option>
                            ))}
                          </select>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
              {s.items.length < PLAN_BOUNDS.itemsPerSession[1] && (
                <button type="button" className="btn btn-sm" onClick={() => upd(si, (x) => ({ ...x, items: [...x.items, defaultItem("scoringDrill", unlocked)] }))}>
                  Add Drill
                </button>
              )}
            </div>
          ))}
          {sessions.length < maxSessions && (
            <button type="button" className="btn btn-sm" onClick={() => setSessions((ss) => [...ss, { title: `Session ${ss.length + 1}`, items: [defaultItem("checkoutDrill", unlocked)] }])}>
              Add Session
            </button>
          )}
          <p className="tag plans-note">Up to {maxSessions} sessions ({weeks} × {perWeek}). You can rearrange everything until you save; saved plans can't be edited.</p>
        </div>
        {err && <p className="plans-error" role="alert">{err}</p>}
        <div className="plan-modal-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save Plan"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ---- plan detail ----------------------------------------------------------

function PlanDetail({ plan, completions, live, onClose, onLaunch, onDelete }) {
  const def = plan.definition;
  const pr = planProgress(def, completions);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inProg = pr.inProgressSession != null ? def.sessions[pr.inProgressSession] : null;
  return (
    <Modal>
      <div className="plan-modal">
        <div className="plan-modal-head">
          <div>
            <div className="plan-modal-kicker">{plan.source === "ai" ? `Made by ${MERLIN.name}` : "Custom plan"} · {fmtDay(plan.created_at)}</div>
            <h3 className="plan-modal-title">{def.title}</h3>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        <div className="plan-sub">{def.goalText || goalLabel(def.goal)}</div>
        <ProgressBar pct={pr.pct} label="Plan progress" />
        <div className="plan-sub">{pr.completed ? "All sessions complete." : `${pr.completeSessions} of ${pr.totalSessions} sessions complete`}</div>
        {def.why && <p className="plan-why">{def.why}</p>}
        <BaselineLine b={plan.baseline} />
        <SessionList def={def} progress={pr} />
        {err && <p className="plans-error" role="alert">{err}</p>}
        {!confirm ? (
          <div className="plan-modal-actions">
            <button type="button" className="btn btn-danger" onClick={() => setConfirm(true)}>
              Delete
            </button>
            {!pr.completed && pr.nextSession != null && (
              <button type="button" className="btn btn-primary" onClick={() => onLaunch(pr.nextSession, pr.nextItem)}>
                {pr.inProgressSession != null || live ? "Continue" : "Start"} {def.sessions[pr.nextSession].title}
              </button>
            )}
          </div>
        ) : (
          <div className="plan-confirm" role="alertdialog" aria-label="Delete this plan?">
            <p>
              <b>Delete “{def.title}”?</b> Its progress goes with it and the slot is freed. Your saved games, stats and achievements stay.
              {inProg ? ` ${inProg.title} is part-way done; that progress will be lost.` : ""}
              {live ? " A game from this plan is still in progress on this device: it will save as ordinary practice." : ""}
            </p>
            <div className="plan-modal-actions">
              <button type="button" className="btn" disabled={busy} onClick={() => setConfirm(false)}>
                Keep Plan
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setErr("");
                  try {
                    await onDelete();
                  } catch (e) {
                    setErr(e.message || "Couldn't delete the plan.");
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Deleting…" : "Delete Plan"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
