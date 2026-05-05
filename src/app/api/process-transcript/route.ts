import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { extractFromTranscript } from "@/lib/llm";
import { ProcessTranscriptInput } from "@/lib/schema";
import { parseUploadedFile } from "@/lib/parsers";
import { isNotionConfigured, pushActionItemToNotion } from "@/lib/notion";

export const runtime = "nodejs"; // mammoth needs Node, not Edge
export const maxDuration = 60;

// =====================================================================
// POST /api/process-transcript
// Accepts EITHER multipart/form-data with a "file" field,
// OR application/json with { title?, transcript, source?, ... }.
// =====================================================================
export async function POST(req: NextRequest) {
  try {
    const ctype = req.headers.get("content-type") || "";

    let title: string | undefined;
    let transcript: string;
    let source: "upload" | "zoom" | "teams" | "email" = "upload";
    let source_ref: string | null = null;
    let occurred_at: string | null = null;

    if (ctype.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
      }
      const parsed = await parseUploadedFile(file);
      transcript = parsed.text;
      title = (form.get("title") as string) || parsed.inferredTitle;
      const s = form.get("source") as string | null;
      if (s) source = s as typeof source;
    } else {
      const json = await req.json();
      const input = ProcessTranscriptInput.parse(json);
      transcript = input.transcript;
      title = input.title;
      source = input.source;
      source_ref = input.source_ref ?? null;
      occurred_at = input.occurred_at ?? null;
    }

    if (!transcript || transcript.length < 20) {
      return NextResponse.json({ error: "Transcript too short" }, { status: 400 });
    }

    // 1. LLM extraction
    const extracted = await extractFromTranscript(transcript, title);

    // 2. Persist
    const sb = getServiceClient();
    const { data: meeting, error: mErr } = await sb
      .from("meetings")
      .insert({
        title: title || extracted.title || "Untitled meeting",
        source,
        source_ref,
        transcript,
        occurred_at,
        processed_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (mErr || !meeting) throw mErr ?? new Error("Failed to insert meeting");

    if (extracted.decisions.length) {
      const { error } = await sb.from("decisions").insert(
        extracted.decisions.map((d) => ({
          meeting_id: meeting.id,
          decision: d.decision,
          rationale: d.rationale ?? null,
          source_quote: d.source_quote ?? null,
          confidence: d.confidence ?? null,
        })),
      );
      if (error) throw error;
    }

    let notionPushed = 0;
    if (extracted.action_items.length) {
      const { data: insertedItems, error } = await sb
        .from("action_items")
        .insert(
          extracted.action_items.map((a) => ({
            meeting_id: meeting.id,
            task: a.task,
            owner: a.owner ?? null,
            deadline: a.deadline ?? null,
            source_quote: a.source_quote ?? null,
            confidence: a.confidence ?? null,
          })),
        )
        .select();
      if (error) throw error;

      // Best-effort sync to Notion. We do this after the Supabase insert so a
      // Notion outage never blocks the upload — the user's data is already safe.
      if (insertedItems && isNotionConfigured()) {
        const meetingTitle = meeting.title;
        const results = await Promise.all(
          insertedItems.map(async (row) => {
            const pageId = await pushActionItemToNotion(
              {
                task: row.task,
                owner: row.owner,
                deadline: row.deadline,
                source_quote: row.source_quote,
                status: row.status,
              },
              meetingTitle,
            );
            return { id: row.id, pageId };
          }),
        );

        // Save the Notion page IDs back so future status updates can sync.
        const updates = results.filter((r) => r.pageId);
        notionPushed = updates.length;
        await Promise.all(
          updates.map((u) =>
            sb
              .from("action_items")
              .update({ notion_page_id: u.pageId })
              .eq("id", u.id),
          ),
        );
      }
    }

    if (extracted.open_questions.length) {
      const { error } = await sb.from("open_questions").insert(
        extracted.open_questions.map((q) => ({
          meeting_id: meeting.id,
          question: q.question,
          context: q.context ?? null,
          source_quote: q.source_quote ?? null,
        })),
      );
      if (error) throw error;
    }

    return NextResponse.json({
      meeting_id: meeting.id,
      counts: {
        decisions: extracted.decisions.length,
        action_items: extracted.action_items.length,
        open_questions: extracted.open_questions.length,
      },
      notion: {
        configured: isNotionConfigured(),
        pushed: notionPushed,
      },
    });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("process-transcript error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: 500 },
    );
  }
}
