import { supabase } from "./supabase";

/** POST an action to /api/admin with the signed-in admin's token. */
export async function callAdmin(payload) {
  const { data } = supabase ? await supabase.auth.getSession() : { data: null };
  const session = data?.session || null;
  const res = await fetch("/api/admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
    },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed.");
  return json;
}
