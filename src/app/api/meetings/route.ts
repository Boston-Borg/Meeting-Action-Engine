import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/meetings  →  list meetings + open-action counts
export async function GET() {
  const sb = getServiceClient();

  const { data: meetings, error } = await sb
    .from("meetings")
    .select("id, title, source, occurred_at, processed_at, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (meetings ?? []).map((m) => m.id);
  let counts: Record<string, { open: number; total: number }> = {};
  if (ids.length) {
    const { data: items, error: e2 } = await sb
      .from("action_items")
      .select("meeting_id, status")
      .in("meeting_id", ids);
    if (e2) {
      return NextResponse.json({ error: e2.message }, { status: 500 });
    }
    counts = ids.reduce(
      (acc, id) => ((acc[id] = { open: 0, total: 0 }), acc),
      {} as typeof counts,
    );
    for (const row of items ?? []) {
      const c = counts[row.meeting_id];
      if (!c) continue;
      c.total++;
      if (row.status === "pending") c.open++;
    }
  }

  return NextResponse.json({
    meetings: (meetings ?? []).map((m) => ({
      ...m,
      action_open: counts[m.id]?.open ?? 0,
      action_total: counts[m.id]?.total ?? 0,
    })),
  });
}
