"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getPlayers, getGameResults, getFollows, getMyEvents } from "@/lib/db";
import { activityFromEvents } from "@/lib/playerEvents";
import { followsForSocial } from "@/lib/follows";
import { computeAchievements } from "@/lib/achievements";

/**
 * The signed-in player's badges and follow counts for the public site's
 * profile page. Loads the rows the database lets this account see and
 * derives everything client-side, like the app does.
 */
export function useMyAchievements(session, player) {
  const [state, setState] = useState({ loading: true, badges: [], social: null });
  const uid = session?.user?.id || null;
  const username = player?.username || null;
  const playerId = player?.id || null;
  useEffect(() => {
    let active = true;
    if (!supabase || !uid || !username) {
      setState({ loading: false, badges: [], social: null });
      return;
    }
    (async () => {
      try {
        const [players, rows, follows, events] = await Promise.all([getPlayers(), getGameResults(), getFollows(), getMyEvents()]);
        const social = { ...followsForSocial(follows, players, { myAuthId: uid, myPlayerId: playerId }), activity: activityFromEvents(events) };
        const results = rows.filter((r) => r.result !== "practice");
        const practice = rows.filter((r) => r.result === "practice");
        const badges = computeAchievements({ me: username, results, practice, social });
        if (active) setState({ loading: false, badges, social });
      } catch {
        if (active) setState({ loading: false, badges: [], social: null });
      }
    })();
    return () => {
      active = false;
    };
  }, [uid, username, playerId]);
  return state;
}
