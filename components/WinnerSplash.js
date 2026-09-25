import { useEffect, useRef } from "react";
import { PlayerBadge, Overlay } from "./ui";
import BadgeMedal from "./BadgeMedal";
import { feedback } from "@/lib/feedback";

const CONFETTI = Array.from({ length: 40 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  delay: ((i * 23 + 7) % 900) / 1000,
  dur: 1.6 + ((i * 13 + 5) % 900) / 1000,
  size: 6 + ((i * 17 + 3) % 6),
  color: ["#ffffff", "#f1c75b", "#e53e3e", "#8177c5", "#4ade80"][(i * 7 + 2) % 5],
}));

/**
 * The end-of-game moment, full screen before the recap: the winner (or
 * "Complete" for solo drills) and any badges this game unlocked. Tap
 * anywhere to skip; it also moves on by itself.
 */
export default function WinnerSplash({ winner, name, title, color, solo = false, badges = [], onDone }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    feedback("big");
    const t = setTimeout(() => doneRef.current?.(), 2600 + Math.min(badges.length, 3) * 900);
    const onKey = (e) => (e.key === "Escape" || e.key === "Enter" || e.key === " ") && doneRef.current?.();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [badges.length]);
  return (
    <Overlay onBackdrop={() => doneRef.current?.()} label="Continue">
      <div className="win-splash" role="dialog" aria-modal="true" aria-label={solo ? `${name} complete` : `${name} wins`} onClick={() => doneRef.current?.()}>
        <div className="win-confetti" aria-hidden="true">
          {CONFETTI.map((p, i) => (
            <span key={i} style={{ left: `${p.left}%`, width: p.size, height: p.size * 0.6, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />
          ))}
        </div>
        <div className="win-body">
          <div className="win-kicker">{solo ? "Complete" : "Winner"}</div>
          <span className="win-avatar">
            <PlayerBadge username={winner} color={color} sizeCss="calc(112px * var(--fs-chrome))" showName={false} />
          </span>
          <div className="win-name">{name}</div>
          {title && <div className="win-title">{title}</div>}
          {badges.length > 0 && (
            <div className="win-badges">
              <div className="win-badges-kicker">Badge{badges.length > 1 ? "s" : ""} Unlocked</div>
              {badges.slice(0, 3).map((b) => (
                <div key={`${b.username}-${b.badge.id}`} className="win-badge">
                  <BadgeMedal badge={b.badge} size={44} />
                  <div>
                    <b>{b.badge.title}</b>
                    <span>{b.badge.description}</span>
                  </div>
                </div>
              ))}
              {badges.length > 3 && <div className="win-more">+{badges.length - 3} more</div>}
            </div>
          )}
          <div className="win-tap">Tap to continue</div>
        </div>
      </div>
    </Overlay>
  );
}
