import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { PatchActionItemInput } from "@/lib/schema";
import { updateNotionPageStatus } from "@/lib/notion";

export const runtime = "nodejs";

// PATCH /api/action-items/:id  →  update status / owner / deadline / task
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PatchActionItemInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("action_items")
    .update(parsed.data)
    .eq("id", params.id)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Not found" },
      { status: error ? 500 : 404 },
    );
  }

  // Best-effort: mirror status changes back to Notion. We don't await on the
  // critical path — if Notion is slow or down, the user's check still succeeds.
  if (parsed.data.status && data.notion_page_id) {
    // Fire and forget; log inside updateNotionPageStatus on failure.
    void updateNotionPageStatus(data.notion_page_id, parsed.data.status);
  }

  return NextResponse.json(data);
}
