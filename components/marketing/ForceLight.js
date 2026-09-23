"use client";

import { useEffect } from "react";

/** The public pages are designed light; /app restores the account's theme. */
export default function ForceLight() {
  useEffect(() => {
    document.documentElement.dataset.theme = "light";
  }, []);
  return null;
}
