import { useEffect, useRef } from "react";
import { progressText } from "@/lib/achievements";
import BadgeMedal from "./BadgeMedal";
import { Overlay } from "./ui";

function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

/**
 * One achievement up close: the medal, what it's for and when it was
 * earned, or, while locked, how far along it is. Closes on the button,
 * the backdrop or Esc, and hands focus back to whatever opened it.
 */
export default function BadgeDetail({ badge, onClose }) {
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const opener = typeof document !== "undefined" ? document.activeElement : null;
    // the overlay mounts through a portal a moment later
    const raf = requestAnimationFrame(() => closeRef.current?.focus());
    const onKey = (e) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, []);
  if (!badge) return null;
  const p = badge.progress;
  const pct = p && p.target ? Math.min(100, Math.round((p.value / p.target) * 100)) : 0;
  return (
    <Overlay onBackdrop={onClose}>
      <div className="modal fade badge-detail" role="dialog" aria-modal="true" aria-labelledby="badge-detail-title" onClick={(e) => e.stopPropagation()}>
        <BadgeMedal badge={badge} locked={!badge.unlocked} size={96} className="badge-detail-medal" />
        <div className="badge-detail-cat">{badge.category}</div>
        <h2 className="badge-detail-title" id="badge-detail-title">{badge.title}</h2>
        <p className="badge-detail-desc">{badge.description}</p>
        {badge.unlocked ? (
          <div className="badge-detail-status is-won">
            {badge.earnedAt ? `Unlocked ${fmtDate(badge.earnedAt)}` : "Unlocked"}
          </div>
        ) : p && p.target ? (
          <div className="badge-detail-status">
            <div className="badge-progress" aria-hidden="true">
              <span style={{ width: `${pct}%` }} />
            </div>
            <div>{progressText(p)}</div>
          </div>
        ) : (
          <div className="badge-detail-status">Not unlocked yet</div>
        )}
        <button ref={closeRef} type="button" className="btn" style={{ width: "100%", marginTop: 16 }} onClick={onClose}>
          Close
        </button>
      </div>
    </Overlay>
  );
}
