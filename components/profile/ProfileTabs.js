import { useRef } from "react";

export const PROFILE_TABS = [
  { id: "activity", label: "Activity" },
  { id: "stats", label: "Statistics" },
  { id: "achievements", label: "Achievements" },
];

/** WAI-ARIA tabs: arrow keys, Home and End move between them. */
export default function ProfileTabs({ tab, setTab }) {
  const refs = useRef({});
  const onKeyDown = (e) => {
    const i = PROFILE_TABS.findIndex((t) => t.id === tab);
    let next = null;
    if (e.key === "ArrowRight") next = PROFILE_TABS[(i + 1) % PROFILE_TABS.length];
    else if (e.key === "ArrowLeft") next = PROFILE_TABS[(i - 1 + PROFILE_TABS.length) % PROFILE_TABS.length];
    else if (e.key === "Home") next = PROFILE_TABS[0];
    else if (e.key === "End") next = PROFILE_TABS[PROFILE_TABS.length - 1];
    if (!next) return;
    e.preventDefault();
    setTab(next.id);
    refs.current[next.id]?.focus();
  };
  return (
    <div className="pf-tabs" role="tablist" aria-label="Profile sections" onKeyDown={onKeyDown}>
      {PROFILE_TABS.map((t) => (
        <button
          key={t.id}
          ref={(el) => (refs.current[t.id] = el)}
          type="button"
          role="tab"
          id={`pf-tab-${t.id}`}
          aria-controls={`pf-panel-${t.id}`}
          aria-selected={tab === t.id}
          tabIndex={tab === t.id ? 0 : -1}
          className="pf-tab"
          onClick={() => setTab(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
