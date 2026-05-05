import Anthropic from "@anthropic-ai/sdk";
import { ExtractionResult, ExtractionResultT } from "./schema";

// =====================================================================
// LLM extractor.
// Default provider: Anthropic. Swap to OpenAI by replacing `callLLM`.
// =====================================================================

const MODEL = process.env.LLM_MODEL || "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are an extraction engine for an accountability system.
Given a meeting transcript, return STRICT JSON describing what happened.

Rules:
- Output JSON ONLY. No prose, no markdown fences.
- Every action_item MUST have a clear, single task and (when stated or strongly implied) an owner.
- "owner" should be a person's name as it appears in the transcript, or null.
- "deadline" must be ISO date "YYYY-MM-DD" relative to "today" if a relative date is given (e.g. "by Friday"). If unknown, null.
- "source_quote" must be a verbatim short quote from the transcript that supports the item.
- "confidence" is your 0..1 self-assessment of how certain you are.
- Decisions are commitments the group agreed to; do NOT confuse them with action items.
- Open questions are unresolved items that need an answer later.
- Do not invent owners, dates, or facts. If unknown, use null.

Return this exact shape:
{
  "title": string,
  "decisions":     [{"decision": string, "rationale": string|null, "source_quote": string|null, "confidence": number|null}],
  "action_items":  [{"task": string, "owner": string|null, "deadline": string|null, "source_quote": string|null, "confidence": number|null}],
  "open_questions":[{"question": string, "context": string|null, "source_quote": string|null}]
}`;

function buildUserPrompt(transcript: string, today: string, hint?: string): string {
  const titleHint = hint ? `Suggested title: ${hint}\n\n` : "";
  return `${titleHint}Today is ${today}.

Extract decisions, action items, and open questions from the following transcript.
Return JSON only.

--- TRANSCRIPT START ---
${transcript}
--- TRANSCRIPT END ---`;
}

/** Call the LLM and return raw text content. */
async function callLLM(transcript: string, titleHint?: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const client = new Anthropic({ apiKey });
  const today = new Date().toISOString().slice(0, 10);

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(transcript, today, titleHint) }],
  });

  // Concatenate all text blocks (defensive across SDK minor versions)
  const text = resp.content
    .map((b: any) => (b?.type === "text" ? String(b.text ?? "") : ""))
    .join("");
  if (!text) throw new Error("LLM returned no text content");
  return text;
}

/** Strip ```json fences if the model added them anyway. */
function stripFences(s: string): string {
  return s
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

/** Best-effort: pull the first balanced JSON object out of a string. */
function extractFirstJsonObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/** Parse + validate + (one) self-heal retry. */
export async function extractFromTranscript(
  transcript: string,
  titleHint?: string,
): Promise<ExtractionResultT> {
  let raw = await callLLM(transcript, titleHint);
  let candidate = stripFences(raw);

  // Try as-is first, then try extracting the first JSON object.
  const tryParse = (txt: string): ExtractionResultT | null => {
    try {
      const json = JSON.parse(txt);
      const parsed = ExtractionResult.safeParse(json);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  };

  let result = tryParse(candidate);
  if (!result) {
    const obj = extractFirstJsonObject(candidate);
    if (obj) result = tryParse(obj);
  }
  if (result) return result;

  // One self-heal retry: ask the model to fix its own output.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("LLM output was invalid and no API key for retry");
  const client = new Anthropic({ apiKey });
  const fix = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system:
      "You convert malformed text into the requested STRICT JSON schema. Output JSON ONLY.",
    messages: [
      {
        role: "user",
        content: `The following text was supposed to match this schema:

{
  "title": string,
  "decisions":[{"decision":string,"rationale":string|null,"source_quote":string|null,"confidence":number|null}],
  "action_items":[{"task":string,"owner":string|null,"deadline":string|null,"source_quote":string|null,"confidence":number|null}],
  "open_questions":[{"question":string,"context":string|null,"source_quote":string|null}]
}

Return a corrected JSON object. No prose.

--- ORIGINAL ---
${raw}
--- END ---`,
      },
    ],
  });
  const fixedText = fix.content
    .map((b: any) => (b?.type === "text" ? String(b.text ?? "") : ""))
    .join("");
  const fixedCandidate = stripFences(fixedText);
  const fixed = tryParse(fixedCandidate) || tryParse(extractFirstJsonObject(fixedCandidate) || "");
  if (fixed) return fixed;

  throw new Error("LLM output failed validation after retry");
}
