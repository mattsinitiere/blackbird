import { useState } from "react";

/** Follow / Following toggle with a pending state and an inline error. */
export default function FollowButton({ user, isFollowing, onFollow, onUnfollow }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (isFollowing == null) return null;
  const act = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await (isFollowing ? onUnfollow() : onFollow());
      if (r && r.ok === false) setError(r.reason || "Something went wrong.");
    } catch (e) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button
        type="button"
        className={`btn btn-sm pf-action ${isFollowing ? "" : "btn-primary"}`}
        onClick={act}
        disabled={busy}
        aria-pressed={isFollowing}
        aria-label={isFollowing ? `Following ${user}. Unfollow` : `Follow ${user}`}
      >
        {busy ? (isFollowing ? "Unfollowing…" : "Following…") : isFollowing ? "Following" : "Follow"}
      </button>
      {error && (
        <span className="pf-action-note pf-error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
