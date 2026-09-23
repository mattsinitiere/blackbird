"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker for the app shell. Production only:
 * a worker that caches pages gets in the way of local development and of
 * automated checks against a dev server.
 */
export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
