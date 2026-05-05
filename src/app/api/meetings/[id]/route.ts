import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import type { MeetingDetail } from "@/types/db";

export const runtime = "nodejs";

// GET /api/meetings/:id  →  meeting + decisions + action_items + open_questions
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const sb = getServiceClient();
  const id = params.id;

  const [m, d, a, q] = await Promise.all([
    sb.from("meetings").select("*").eq("id", id).single(),
    sb
      .from("decisions")
      .select("*")
      .eq("meeting_id", id)
      .order("created_at", { ascending: true }),
    sb
      .from("action_items")
      .select("*")
      .eq("meeting_id", id)
      .order("created_at", { ascending: true }),
    sb
      .from("open_questions")
      .select("*")
      .eq("meeting_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (m.error || !m.data) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }
  if (d.error || a.error || q.error) {
    return NextResponse.json(
      { error: d.error?.message ?? a.error?.message ?? q.error?.message },
      { status: 500 },
    );
  }

  const detail: MeetingDetail = {
    ...m.data,
    decisions: d.data ?? [],
    action_items: a.data ?? [],
    open_questions: q.data ?? [],
  };
  return NextResponse.json(detail);
}

// DELETE /api/meetings/:id  →  cascades to children
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const sb = getServiceClient();
  const { error } = await sb.from("meetings").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
