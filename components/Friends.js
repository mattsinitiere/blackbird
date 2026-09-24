import { useState, useMemo } from "react";
import { BackBar, PlayerBadge, pressProps } from "./ui";
import { searchPlayers } from "@/lib/follows";

/**
 * Friends: follow people by name or @handle. You see the games and stats
 * of everyone you follow (the database enforces it), and anyone who
 * follows you sees yours. One-way: no accept step.
 */
export default function Friends({ players, me, following, followers, social, follow, unfollow, openProfile, playerColors, installed, back }) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState("");
  const results = useMemo(() => searchPlayers(players, query, { exclude: [me] }), [players, query, me]);
  const isFollowing = (u) => !!following && following.has(u);

  const toggle = async (u) => {
    setBusy(u);
    setMsg("");
    try {
      const r = isFollowing(u) ? await unfollow(u) : await follow(u);
      if (!r.ok) setMsg(r.reason || "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  const Row = ({ u, right }) => {
    const p = players.find((x) => x.username === u);
    return (
      <div className="between" style={{ padding: "10px 0", borderBottom: "1px solid var(--line)", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, cursor: "pointer" }} {...pressProps(() => openProfile(u))}>
          <PlayerBadge username={u} color={playerColors?.[u]} size={32} showName={false} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u}</div>
            <div className="tag" style={{ textTransform: "none", letterSpacing: 0, color: p?.handle ? "var(--accent)" : undefined }}>
              {p?.handle ? `@${p.handle}` : p?.authId ? "no handle yet" : "guest player"}
            </div>
          </div>
        </div>
        {right}
      </div>
    );
  };

  const FollowButton = ({ u }) => (
    <button
      className={`btn btn-sm ${isFollowing(u) ? "" : "btn-primary"}`}
      onClick={() => toggle(u)}
      disabled={busy === u || !installed}
      aria-pressed={isFollowing(u)}
      style={{ flex: "none", minWidth: 96 }}
    >
      {busy === u ? "…" : isFollowing(u) ? "Following" : followers?.has(u) ? "Follow back" : "Follow"}
    </button>
  );

  const followingList = social?.following || [];
  const followerList = social?.followers || [];

  return (
    <div className="fade">
      <BackBar back={back} title="Friends" />

      {!installed && (
        <div className="card mb-12" style={{ borderColor: "var(--amber)" }}>
          <p className="subtle" style={{ margin: 0, color: "var(--amber)" }}>
            Friends aren&apos;t switched on for this database yet. The site owner needs to run <code>supabase/migration-follows-tags.sql</code>. Until then everyone sees everyone.
          </p>
        </div>
      )}

      <div className="card mb-12">
        <div className="tag" style={{ marginBottom: 8 }}>Find players</div>
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name or @handle"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Find players"
        />
        <p className="tag" style={{ margin: "8px 0 0", textTransform: "none", letterSpacing: 0 }}>
          Follow someone to see their games in your standings, records and matchups. Anyone who follows you sees yours.
        </p>
        {query.trim() && (
          <div style={{ marginTop: 6 }}>
            {results.length === 0 && <p className="subtle" style={{ margin: "10px 0 0" }}>No players match.</p>}
            {results.map((p) => (
              <Row key={p.username} u={p.username} right={<FollowButton u={p.username} />} />
            ))}
          </div>
        )}
        {msg && (
          <p className="subtle" role="alert" style={{ margin: "10px 0 0", color: "var(--red)" }}>{msg}</p>
        )}
      </div>

      <div className="card mb-12">
        <div className="between" style={{ marginBottom: 4 }}>
          <h3 className="section-title" style={{ margin: 0 }}>Following</h3>
          <span className="tag">{followingList.length}</span>
        </div>
        {followingList.length === 0 ? (
          <p className="subtle" style={{ margin: "8px 0 0" }}>
            {installed ? "You don't follow anyone yet. Search above to find players." : "Everyone, until friends are switched on."}
          </p>
        ) : (
          followingList.map((f) => <Row key={f.username} u={f.username} right={<FollowButton u={f.username} />} />)
        )}
      </div>

      <div className="card mb-12">
        <div className="between" style={{ marginBottom: 4 }}>
          <h3 className="section-title" style={{ margin: 0 }}>Followers</h3>
          <span className="tag">{followerList.length}</span>
        </div>
        {followerList.length === 0 ? (
          <p className="subtle" style={{ margin: "8px 0 0" }}>Nobody follows you yet.</p>
        ) : (
          followerList.map((f) => <Row key={f.username} u={f.username} right={<FollowButton u={f.username} />} />)
        )}
      </div>
    </div>
  );
}
