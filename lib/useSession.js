"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * The signed-in Supabase session, if any. `ready` is false until the first
 * check completes so callers can avoid flashing the wrong state. When
 * Supabase is not configured the hook reports ready with no session, so
 * public pages still render.
 */
export function useSession() {
  const [state, setState] = useState({ ready: !supabase, session: null });
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setState({ ready: true, session: data.session });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (active) setState({ ready: true, session: s });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return state;
}
