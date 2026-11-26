"use client";

import { useEffect } from "react";
import { applyThemePref } from "@/lib/prefs";

/** The public pages are designed light; /app restores the account's theme. */
export default function ForceLight() {
  useEffect(() => {
    // also stops /app's "follow the device" listener
    applyThemePref("light");
  }, []);
  return null;
}
