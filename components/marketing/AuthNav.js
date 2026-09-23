"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/lib/useSession";
import { useMyPlayer } from "@/lib/useMyPlayer";
import { PlayerBadge } from "@/components/ui";

/**
 * Header actions that follow the session: Sign In + Sign Up for visitors,
 * Sign out + avatar (in the player's own colour, linking to /profile) +
 * Play once signed in. Until the session check resolves the signed-out
 * pair is rendered invisibly so the header never shifts.
 */
export default function AuthNav() {
  const { ready, session } = useSession();
  const { player, color } = useMyPlayer(session);
  const [leaving, setLeaving] = useState(false);
  const name = player?.username || (session?.user?.user_metadata?.display_name || "").trim();
  const signOut = async () => {
    setLeaving(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setLeaving(false);
    }
  };
  if (ready && session) {
    return (
      <div className="mk-nav-actions">
        <button className="mk-signin mk-signout" type="button" onClick={signOut} disabled={leaving}>
          {leaving ? "Signing out…" : "Sign out"}
        </button>
        <Link className="mk-signin mk-nav-badge" href="/profile" aria-label={name ? `${name}, view your profile` : "Your profile"} title="Your profile">
          <PlayerBadge username={name || "?"} color={color} size={28} showName={false} />
        </Link>
        <Link className="mk-button mk-small" href="/app">
          Play <span aria-hidden="true">→</span>
        </Link>
      </div>
    );
  }
  return (
    <div className={`mk-nav-actions${ready ? "" : " mk-is-pending"}`} aria-busy={!ready}>
      <Link className="mk-signin" href="/login">
        Sign In
      </Link>
      <Link className="mk-button mk-small" href="/signup">
        Sign Up
      </Link>
    </div>
  );
}
