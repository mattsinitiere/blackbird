import { PlayerBadge } from "./ui";
import Icon from "./Icon";
import { TAG_ICONS, DEV_TAG_ICONS, TAG_MAX, normalizeTag, validateTag } from "@/lib/profile";

/**
 * Name tag editor shared by the app's Account screen and the website's
 * profile page: 2–5 letters/digits and/or one icon, with a live preview.
 * Controlled: the parent owns `tag` and `tagIcon` and saves them.
 */
export default function TagEditor({ username, color, tag, tagIcon, onChange, idPrefix = "tag", isDev = false }) {
  const check = validateTag(tag);
  return (
    <div>
      <div className="tag" style={{ margin: "14px 0 6px" }}>Name tag</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <PlayerBadge username={username} color={color} size={28} tag={tag || null} tagIcon={tagIcon || null} />
        {!tag && !tagIcon && <span className="tag" style={{ textTransform: "none", letterSpacing: 0 }}>no tag</span>}
      </div>
      <input
        id={`${idPrefix}-text`}
        className="input"
        value={tag || ""}
        maxLength={TAG_MAX}
        placeholder="e.g. LHRN"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        style={{ textTransform: "uppercase", letterSpacing: "0.1em", borderColor: check.ok ? undefined : "var(--red)" }}
        onChange={(e) => onChange({ tag: normalizeTag(e.target.value), tagIcon })}
        aria-label="Name tag letters"
      />
      <p className="tag" style={{ margin: "6px 0 8px", textTransform: "none", letterSpacing: 0, color: check.ok ? undefined : "var(--red)" }}>
        {check.ok ? "2–5 letters or numbers, shown beside your name. Pick an icon too, or instead." : check.reason}
      </p>
      <div className="tag-icon-grid" role="group" aria-label="Tag icon">
        <button
          type="button"
          className={`chip tag-icon-chip${!tagIcon ? " on" : ""}`}
          onClick={() => onChange({ tag, tagIcon: null })}
          aria-pressed={!tagIcon}
          aria-label="No icon"
          title="No icon"
        >
          <Icon id="none" size="1.1em" />
        </button>
        {TAG_ICONS.map((i) => (
          <button
            key={i.id}
            type="button"
            className={`chip tag-icon-chip${tagIcon === i.id ? " on" : ""}`}
            onClick={() => onChange({ tag, tagIcon: i.id })}
            aria-pressed={tagIcon === i.id}
            aria-label={i.label}
            title={i.label}
          >
            <Icon id={i.id} size="1.1em" />
          </button>
        ))}
      </div>
      {isDev && (
        <>
          <div className="tag" style={{ margin: "12px 0 6px" }}>Developer only</div>
          <div className="tag-icon-grid" role="group" aria-label="Developer tag icon">
            {DEV_TAG_ICONS.map((i) => (
              <button
                key={i.id}
                type="button"
                className={`chip tag-icon-chip is-dev${tagIcon === i.id ? " on" : ""}`}
                onClick={() => onChange({ tag, tagIcon: i.id })}
                aria-pressed={tagIcon === i.id}
                aria-label={`${i.label} (developer only)`}
                title={i.label}
              >
                <Icon id={i.id} size="1.1em" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
