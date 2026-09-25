"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { defaultPlayerColor } from "@/lib/constants";

/** Dispatched on window after the profile page saves, so other hooks refetch. */
export const PLAYER_UPDATED_EVENT = "bb-player-updated";

const COLS = [
  "id, username, created_at, hidden, elo, color, auth_id, handle, bio, location, tag, tag_icon, cover",
  "id, username, created_at, hidden, elo, color, auth_id, handle, bio, location, tag, tag_icon",
  "id, username, created_at, hidden, elo, color, auth_id, handle, bio, location",
  "id, username, created_at, hidden, elo, color, auth_id",
  "id, username, created_at, hidden, elo, color",
];

function shape(r) {
  return {
    id: r.id ?? null,
    username: r.username,
    createdAt: r.created_at,
    hidden: !!r.hidden,
    elo: r.elo == null ? 1000 : Number(r.elo),
    color: r.color || null,
    authId: r.auth_id || null,
    handle: r.handle || null,
    bio: r.bio || "",
    location: r.location || "",
    tag: r.tag || null,
    tagIcon: r.tag_icon || null,
    cover: r.cover || null,
  };
}

/**
 * The signed-in account's own player row, for the public site (header
 * avatar, profile page). Resolved the same way the app does: by auth_id
 * first, then by display name. `reload()` refetches after an edit.
 * Returns { loading, player, color } where color is always usable.
 */
export function useMyPlayer(session) {
  const [state, setState] = useState({ loading: true, player: null });
  const uid = session?.user?.id || null;
  const name = (session?.user?.user_metadata?.display_name || "").trim();

  const load = useCallback(async () => {
    if (!supabase || !uid) {
      setState({ loading: false, player: null });
      return;
    }
    let rows = null;
    for (const cols of COLS) {
      const { data, error } = await supabase.from("players").select(cols);
      if (!error) {
        rows = data || [];
        break;
      }
    }
    const players = (rows || []).map(shape);
    const lower = name.toLowerCase();
    const mine = players.find((p) => p.authId === uid) || players.find((p) => p.username.toLowerCase() === lower) || null;
    setState({ loading: false, player: mine });
  }, [uid, name]);

  useEffect(() => {
    let active = true;
    // only the first fetch shows a loading state; later refetches (after a
    // profile edit, or a display-name change) update in place
    setState((s) => (s.player ? s : { ...s, loading: true }));
    load().catch(() => active && setState({ loading: false, player: null }));
    const onUpdate = () => load().catch(() => {});
    window.addEventListener(PLAYER_UPDATED_EVENT, onUpdate);
    return () => {
      active = false;
      window.removeEventListener(PLAYER_UPDATED_EVENT, onUpdate);
    };
  }, [load]);

  const player = state.player;
  const color = player ? player.color || defaultPlayerColor(player.username) : defaultPlayerColor(name || "?");
  return { loading: state.loading, player, color, reload: load };
}
