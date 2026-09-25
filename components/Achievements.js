import { useState } from "react";
import { CATEGORIES, progressText } from "@/lib/achievements";
import BadgeDetail from "./BadgeDetail";
import BadgeMedal from "./BadgeMedal";

function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

/**
 * The badge grid on a profile. Unlocked tiles show the earned date;
 * locked ones are dimmed with a progress bar when the badge counts
 * something. "New" marks badges the owner has not seen yet.
 */
export default function AchievementsCard({ badges, isMe, seen }) {
  const [open, setOpen] = useState(null);
  if (!badges || !badges.length) return null;
  const unlocked = badges.filter((b) => b.unlocked).length;
  return (
    <div className="card mb-12">
      <div className="between" style={{ marginBottom: 6 }}>
        <h3 className="section-title" style={{ margin: 0 }}>Achievements</h3>
        <span className="tag">{unlocked} / {badges.length}</span>
      </div>
      {CATEGORIES.map((cat) => {
        const list = badges.filter((b) => b.category === cat);
        if (!list.length) return null;
        return (
          <section key={cat} className="badge-section" aria-label={cat}>
            <div className="badge-section-head">
              <span className="badge-section-title">{cat}</span>
              <span className="badge-section-count">
                {list.filter((b) => b.unlocked).length}/{list.length}
              </span>
            </div>
            <div className="badge-grid">
              {list.map((b) => {
                const isNew = isMe && b.unlocked && seen && !seen.has(b.id);
                const pct = b.progress && b.progress.target ? Math.round((b.progress.value / b.progress.target) * 100) : 0;
                return (
                  <button type="button" key={b.id} className={`badge-tile${b.unlocked ? "" : " locked"}`} onClick={() => setOpen(b)} aria-label={`${b.title}: ${b.unlocked ? "unlocked" : "locked"}. Details`}>
                    {isNew && <span className="badge-new">New</span>}
                    <BadgeMedal badge={b} locked={!b.unlocked} size={46} className="badge-icon" />
                    <div className="badge-title">{b.title}</div>
                    {b.unlocked ? (
                      <div className="badge-meta">{fmtDate(b.earnedAt)}</div>
                    ) : b.progress ? (
                      <>
                        <div className="badge-progress" aria-hidden="true">
                          <span style={{ width: `${pct}%` }} />
                        </div>
                        <div className="badge-meta">{progressText(b.progress, { short: true })}</div>
                      </>
                    ) : (
                      <div className="badge-meta">{b.description}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      {open && <BadgeDetail badge={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
