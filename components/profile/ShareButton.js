import { useState } from "react";
import { ShareIcon } from "./icons";

/**
 * Shares a link that opens this exact player's profile: the system share
 * sheet when there is one, otherwise the clipboard, otherwise the link is
 * shown to copy by hand.
 */
export default function ShareButton({ player, user }) {
  const [status, setStatus] = useState("");
  const [manual, setManual] = useState("");

  const share = async () => {
    setStatus("");
    setManual("");
    // the app itself: a profile link means nothing to someone not signed in
    const url = `${window.location.origin}/`;
    const title = "Blackbird Dart Scoring System";
    if (navigator.share) {
      try {
        await navigator.share({ title, text: "Score darts, track your stats and play your friends on Blackbird.", url });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied.");
    } catch {
      setManual(url);
    }
  };

  return (
    <>
      <button type="button" className="btn btn-sm pf-action" onClick={share}>
        <ShareIcon /> Share
      </button>
      <span className="pf-action-note" role="status" aria-live="polite">
        {status}
      </span>
      {manual && (
        <input className="input pf-share-url" readOnly value={manual} aria-label="Profile link" onFocus={(e) => e.target.select()} />
      )}
    </>
  );
}
