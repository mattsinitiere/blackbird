/**
 * Pull the plan JSON out of a model reply: a bare object, or one inside a
 * ```json fence, with light tolerance for text around it. Returns the
 * parsed object or null. Validation happens separately
 * (lib/trainingPlans.js validatePlanDefinition).
 */
export function parsePlanJSON(text) {
  const s = String(text || "");
  const fenced = /```(?:json)?\s*\n([\s\S]*?)```/i.exec(s);
  const candidates = [];
  if (fenced) candidates.push(fenced[1]);
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(s.slice(first, last + 1));
  for (const c of candidates) {
    try {
      const v = JSON.parse(c.trim());
      if (v && typeof v === "object" && !Array.isArray(v)) return v.plan && typeof v.plan === "object" ? v.plan : v;
    } catch {
      // try the next candidate
    }
  }
  return null;
}
