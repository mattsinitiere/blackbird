"use client";

import Link from "next/link";
import { useSession } from "@/lib/useSession";

/**
 * The hero's buttons follow the session like the header does: a signed-in
 * player gets one way in ("Open Blackbird"), not a Sign In they don't need.
 */
export default function HeroActions() {
  const { ready, session } = useSession();
  const signedIn = ready && !!session;
  return (
    <div className="mk-hero-actions">
      <Link className="mk-button" href="/app">
        Open Blackbird
      </Link>
      {!signedIn && (
        <Link className="mk-button mk-secondary" href="/login">
          Sign In
        </Link>
      )}
    </div>
  );
}
