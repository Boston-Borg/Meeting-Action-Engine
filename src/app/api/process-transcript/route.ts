import { NextRequest, NextResponse } from "next/server";
import { extractFromTranscript } from "@/lib/llm";
import { ProcessTranscriptInput } from "@/lib/schema";
import { parseUploadedFile } from "@/lib/parsers";
import { isNotionConfigured, pushActionItemToNotion } from "@/lib/notion";

export const runtime = "nodejs"; // mammoth needs Node, not Edge
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// =====================================================================
// POST /api/process-transcript
//
// STATELESS: this endpoint deliberately does NOT persist anything to
// the application database. The transcript is processed by the LLM in
// memory; the structured outputs are returned to the caller and (best-
// effort) pushed to Notion. Once this function returns, no trace of
// the upload remains on the server.
//
// Accepts EITHER multipart/form-data with a "file" field, OR
// application/json with { title?, transcript, source?, ... }.
// =====================================================================
export async function POST(req: NextRequest) {
  try {
    const ctype = req.headers.get("content-type") || "";

    let title: string | undefined;
    let transcript: string;

    if (ctype.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
      }
      const parsed = await parseUploadedFile(file);
      transcript = parsed.text;
      title = (form.get("title") as string) || parsed.inferredTitle;
    } else {
      const json = await req.json();
      const input = ProcessTranscriptInput.parse(json);
      transcript = input.transcript;
      title = input.title;
    }

    if (!transcript || transcript.length < 20) {
      return NextResponse.json({ error: "Transcript too short" }, { status: 400 });
    }

    // 1. LLM extraction
    const extracted = await extractFromTranscript(transcript, title);
    const meetingTitle = title || extracted.title || "Untitled meeting";

    // 2. Best-effort Notion push (doesn't block on failures)
    let notionPushed = 0;
    if (isNotionConfigured() && extracted.action_items.length) {
      const results = await Promise.all(
        extracted.action_items.map((a) =>
          pushActionItemToNotion(
            {
              task: a.task,
              owner: a.owner ?? null,
              deadline: a.deadline ?? null,
              source_quote: a.source_quote ?? null,
              status: "pending",
            },
            meetingTitle,
          ),
        ),
      );
      notionPushed = results.filter(Boolean).length;
    }

    // 3. Return everything to the caller. Nothing is persisted server-side.
    return NextResponse.json({
      title: meetingTitle,
      decisions: extracted.decisions,
      action_items: extracted.action_items,
      open_questions: extracted.open_questions,
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
