import { createContext, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { defaultPlayerColor } from "@/lib/constants";
import { playerLabel, isBot } from "@/lib/bots";
import { isTagIcon, isDevTagIcon, tagLabel } from "@/lib/profile";
import Icon from "./Icon";
import BotAvatar, { hasPortrait } from "./BotAvatar";

/**
 * How each player looks: { [username]: { color, tag, tagIcon } }. Provided
 * once by the app shell so PlayerBadge can show name tags everywhere
 * without every call site threading them through.
 */
export const PlayerLookContext = createContext(null);

/** The name tag pill: icon and/or 2–5 letters. Renders nothing without either. */
export function TagPill({ tag, tagIcon, className = "" }) {
  const icon = isTagIcon(tagIcon) ? tagIcon : null;
  if (!icon && !tag) return null;
  return (
    <span className={`tag-pill ${isDevTagIcon(icon) ? "is-dev" : ""} ${className}`.replace(/\s+/g, " ").trim()} aria-label={`tag ${tagLabel({ tag, tagIcon: icon })}`}>
      {icon && <Icon id={icon} size="1.15em" strokeWidth={2.4} className="tag-pill-icon" />}
      {tag && <span>{tag}</span>}
    </span>
  );
}

const LOGO_ASPECT = {
  lockup: 3769.755 / 1072.743,
  word: 2995.033 / 914.325,
  icon: 1,
};

/**
 * Official Blackbird logo from /public/brand. `variant` is "lockup" (icon +
 * wordmark + tagline), "word" (wordmark only) or "icon". Both the color and
 * the white file are in the DOM; globals.css shows the one that matches the
 * active theme, so there is no flash and no JS theme lookup.
 */
export function Logo({ variant = "lockup", height = 36, className = "", label = "Blackbird" }) {
  const aspect = LOGO_ASPECT[variant] || LOGO_ASPECT.lockup;
  const width = Math.round(height * aspect);
  return (
    <span className={`logo logo-${variant} ${className}`.trim()} style={{ width, height }} role="img" aria-label={label}>
      <img className="logo-color" src={`/brand/${variant}-color.svg`} alt="" width={width} height={height} />
      <img className="logo-white" src={`/brand/${variant}-white.svg`} alt="" width={width} height={height} />
    </span>
  );
}

export function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="num">{value}</div>
      <div className="tag" style={{ marginTop: 3 }}>
        {label}
      </div>
    </div>
  );
}

export function Mini({ label, value }) {
  return (
    <div className="mini">
      <div className="num">{value}</div>
      <div className="tag" style={{ marginTop: 2, fontSize: "calc(10px * var(--fs-chrome))" }}>
        {label}
      </div>
    </div>
  );
}

/**
 * Gear icon for the settings button. Sized in em so it tracks the button's
 * font size, and therefore the user's text-size setting.
 */
export function GearIcon({ size = "1.2em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block", flex: "none" }}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/** Flat single-color cast-to-TV icon (screen + signal arcs). */
export function CastIcon({ size = "1.1em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block", flex: "none" }}
    >
      <path d="M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
      <path d="M2 12a9 9 0 0 1 8 8" />
      <path d="M2 16a5 5 0 0 1 4 4" />
      <line x1="2" y1="20" x2="2.01" y2="20" />
    </svg>
  );
}

export function ShuffleIcon({ size = "1em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block", flex: "none" }}
    >
      <path d="M16 3h5v5" />
      <path d="M4 20L21 3" />
      <path d="M21 16v5h-5" />
      <path d="M15 15l6 6" />
      <path d="M4 4l5 5" />
    </svg>
  );
}

export function DragIcon({ size = "1em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
      style={{ display: "block", flex: "none" }}
    >
      <circle cx="6" cy="3" r="1.5" />
      <circle cx="10" cy="3" r="1.5" />
      <circle cx="6" cy="8" r="1.5" />
      <circle cx="10" cy="8" r="1.5" />
      <circle cx="6" cy="13" r="1.5" />
      <circle cx="10" cy="13" r="1.5" />
    </svg>
  );
}

export function PersonIcon({ size = "1.2em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
      style={{ display: "block", flex: "none" }}
    >
      <circle cx="12" cy="7" r="4" />
      <path d="M12 13c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z" />
    </svg>
  );
}

export function isLight(hex) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

// `sizeCss` (any CSS length) overrides `size`, for avatars sized by a stylesheet
export function PlayerBadge({ username, color, size = 24, showName = true, tag, tagIcon, showTag, sizeCss }) {
  const look = useContext(PlayerLookContext)?.[username];
  const bg = color || look?.color || defaultPlayerColor(username);
  const fg = isLight(bg) ? "#333" : "#fff";
  const label = playerLabel(username);
  const effTag = tag !== undefined ? tag : look?.tag;
  const effIcon = tagIcon !== undefined ? tagIcon : look?.tagIcon;
  const pill = (showTag ?? showName) ? <TagPill tag={effTag} tagIcon={effIcon} /> : null;
  // bots show their character portrait instead of an initial
  const portrait = isBot(username) && hasPortrait(username);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {portrait ? (
        <BotAvatar bot={username} size={size} sizeCss={sizeCss} />
      ) : (
      <span
        style={{
          width: sizeCss || size,
          height: sizeCss || size,
          borderRadius: "50%",
          background: bg,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
          color: fg,
          fontSize: sizeCss ? `calc(${sizeCss} * 0.52)` : size * 0.52,
          fontWeight: 700,
          lineHeight: 1,
          userSelect: "none",
        }}
      >
        {label.charAt(0).toUpperCase()}
      </span>
      )}
      {showName && <span style={{ fontWeight: 700 }}>{label}</span>}
      {pill}
    </span>
  );
}

/**
 * Page heading with an optional back button. Screens reached from the
 * bottom nav pass no `back` and get just the title; drill-in screens keep
 * the button (in-app views don't move with the browser's back gesture).
 */
export function BackBar({ back, title }) {
  if (!back && !title) return null;
  return (
    <div className="row" style={{ alignItems: "center", marginBottom: title ? 16 : 8, minHeight: 40 }}>
      {back && (
      <button
        className="btn"
        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, padding: 0, flex: "none" }}
        onClick={back}
        aria-label="Back"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      )}
      {title && (
        <div className="display" style={{ fontSize: "calc(19px * var(--fs))" }}>
          {title}
        </div>
      )}
    </div>
  );
}

/**
 * A dimmed layer over the whole screen. Rendered into document.body (a
 * portal) because every screen lives inside the app's scroll area and an
 * animated .fade wrapper; on iPhone a fixed element in there is pinned to
 * the scrolling content, not the screen. While open, the app's scroll
 * area is locked so the page can't move behind it.
 */
// every area that can scroll behind a pop-up: the page, the Merlin chat's
// message list and its input
const BEHIND_SCROLLERS = ".scroll, .ai-messages, .ai-input";
let openOverlays = 0;
let restoreScroll = null;

function lockBehind() {
  if (openOverlays++ > 0) return; // already locked by an outer pop-up
  // html and body too: iOS Safari otherwise drags (rubber-bands) the whole
  // page behind a fixed pop-up
  const els = [document.documentElement, document.body, ...document.querySelectorAll(BEHIND_SCROLLERS)];
  const prev = els.map((el) => [el.style.overflow, el.style.overflowY, el.style.overscrollBehavior]);
  els.forEach((el) => {
    el.style.overflow = "hidden";
    el.style.overflowY = "hidden";
    el.style.overscrollBehavior = "none";
  });
  restoreScroll = () =>
    els.forEach((el, i) => {
      el.style.overflow = prev[i][0];
      el.style.overflowY = prev[i][1];
      el.style.overscrollBehavior = prev[i][2];
    });
}

function unlockBehind() {
  if (--openOverlays > 0) return; // an outer pop-up is still open
  openOverlays = 0;
  restoreScroll?.();
  restoreScroll = null;
}

export function Overlay({ children, onBackdrop, label, className = "" }) {
  const [host, setHost] = useState(null);
  useEffect(() => {
    setHost(document.body);
    lockBehind();
    return unlockBehind;
  }, []);
  if (!host) return null;
  return createPortal(
    <div className={`modal-backdrop${className ? ` ${className}` : ""}`} onClick={onBackdrop} role="presentation" aria-label={label}>
      {children}
    </div>,
    host
  );
}

export function Modal({ children }) {
  return (
    <Overlay>
      <div className="modal fade" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </Overlay>
  );
}

/**
 * Props that make a non-button element behave like one: focusable, announced
 * as a button, and activated by Enter or Space as well as click.
 */
export function pressProps(onActivate) {
  return {
    role: "button",
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    },
  };
}

/** Four-point sparkle for the Blackbird AI tab. */
export function UndoIcon({ size = "1em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block", flex: "none" }}
    >
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </svg>
  );
}

/* Bottom-nav line icons: 24px grid, 2px stroke, currentColor. */
function NavSvg({ children, size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block", flex: "none" }}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props) {
  return (
    <NavSvg {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9v11h14V9" />
      <path d="M10 20v-6h4v6" />
    </NavSvg>
  );
}

/** A dartboard: three rings and the bull. */
export function PlayIcon(props) {
  return (
    <NavSvg {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="2" />
    </NavSvg>
  );
}

export function StatsIcon(props) {
  return (
    <NavSvg {...props}>
      <path d="M4 20h16" />
      <path d="M7 16v-5" />
      <path d="M12 16V6" />
      <path d="M17 16v-8" />
    </NavSvg>
  );
}

/** Two darts crossed: head to head. Straight shafts, fins at the tail. */
export function MatchupIcon(props) {
  return (
    <NavSvg {...props}>
      <path d="M5 19L17.5 6.5" />
      <path d="M17.5 6.5l2-2" />
      <path d="M5 19H8.5M5 19v-3.5" />
      <path d="M19 19L6.5 6.5" />
      <path d="M6.5 6.5l-2-2" />
      <path d="M19 19h-3.5M19 19v-3.5" />
    </NavSvg>
  );
}

/** Magnifier for Home search. */
export function SearchIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.6-3.6" />
    </svg>
  );
}

/** The Merlin sparkle (the chat tab). */
export function SparkleIcon(props) {
  return (
    <NavSvg {...props}>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
    </NavSvg>
  );
}
