import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

// GET /api/people  →  aggregate action items by owner
//
// Returns one row per owner with: open, overdue, soonest_deadline.
// Owners are matched case-insensitively after trimming whitespace, so
// "Marcus" and "  marcus " collapse to a single bucket.
export async function GET() {
  const sb = getServiceClient();

  const { data, error } = await sb
    .from("action_items")
    .select("owner, deadline, status")
    .eq("status", "pending");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const buckets = new Map<
    string,
    { displayName: string; open: number; overdue: number; soonest: string | null }
  >();

  for (const row of data ?? []) {
    const ownerRaw = (row.owner ?? "").trim();
    if (!ownerRaw) continue; // skip unassigned in this view; show separately later
    const key = ownerRaw.toLowerCase();
    const b = buckets.get(key) ?? {
      displayName: ownerRaw,
      open: 0,
      overdue: 0,
      soonest: null,
    };
    b.open += 1;
    if (row.deadline && row.deadline < today) b.overdue += 1;
    if (row.deadline) {
      if (!b.soonest || row.deadline < b.soonest) b.soonest = row.deadline;
    }
    buckets.set(key, b);
  }

  // Sort: most overdue first, then soonest deadline, then by name
  const people = Array.from(buckets.values()).sort((a, b) => {
    if (b.overdue !== a.overdue) return b.overdue - a.overdue;
    const aDate = a.soonest ?? "9999-12-31";
    const bDate = b.soonest ?? "9999-12-31";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return a.displayName.localeCompare(b.displayName);
  });

  return NextResponse.json({ people, generated_at: new Date().toISOString() });
}
