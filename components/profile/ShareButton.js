import { useState } from "react";
import { profileHref } from "@/lib/profileLink";
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
    const url = `${window.location.origin}${profileHref(player || { username: user })}`;
    const title = `${user} on Blackbird`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `${user}'s darts profile`, url });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Profile link copied.");
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
