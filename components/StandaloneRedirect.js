"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/useSession";

/**
 * A home-screen install is the scoring app, not the website. When a public
 * page opens in standalone mode (an icon installed before the manifest
 * pointed at /app), go straight to the app if signed in, otherwise to
 * sign-in. Browser visitors never see this; the CSS in globals.css hides
 * the page in standalone mode until the check resolves so nothing flashes.
 */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    window.navigator.standalone === true
  );
}

export default function StandaloneRedirect({ signedOutTo = "/login" }) {
  const router = useRouter();
  const { ready, session } = useSession();
  useEffect(() => {
    if (!ready) return;
    if (isStandalone()) {
      router.replace(session ? "/app" : signedOutTo);
      return;
    }
    document.documentElement.dataset.standaloneChecked = "1";
  }, [ready, session, router, signedOutTo]);
  return null;
}
