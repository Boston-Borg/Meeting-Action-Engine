import mammoth from "mammoth";

// =====================================================================
// File parsers — turn an uploaded file into a clean transcript string.
// Supported: .txt, .vtt, .docx
// =====================================================================

export type ParsedTranscript = {
  text: string;
  inferredTitle: string;
};

export async function parseUploadedFile(file: File): Promise<ParsedTranscript> {
  const name = file.name || "transcript";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const inferredTitle = name.replace(/\.[^.]+$/, "") || "Untitled meeting";

  switch (ext) {
    case "txt":
    case "md": {
      const text = await file.text();
      return { text: normalizeWhitespace(text), inferredTitle };
    }
    case "vtt": {
      const raw = await file.text();
      return { text: stripVtt(raw), inferredTitle };
    }
    case "docx": {
      const buf = Buffer.from(await file.arrayBuffer());
      const { value } = await mammoth.extractRawText({ buffer: buf });
      return { text: normalizeWhitespace(value), inferredTitle };
    }
    default:
      throw new Error(
        `Unsupported file type ".${ext}". Supported: .txt, .vtt, .docx`,
      );
  }
}

// ---------------------------------------------------------------------
// VTT cleaner — strips WEBVTT header, cue ids, and HH:MM:SS timestamps,
// preserves speaker labels and the spoken text.
// ---------------------------------------------------------------------
export function stripVtt(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/^WEBVTT/i.test(t)) continue;
    if (/^NOTE\b/i.test(t)) continue;
    // cue identifier (numeric or hex-ish)
    if (/^[0-9a-f-]+$/i.test(t) && t.length < 40) continue;
    // timestamp line: 00:00:00.000 --> 00:00:05.000
    if (/-->/.test(t)) continue;
    // strip inline tags like <v Speaker> and <c.colorE5E5E5>
    const cleaned = t
      .replace(/<v\s+([^>]+)>/gi, "$1: ")
      .replace(/<\/v>/gi, "")
      .replace(/<[^>]+>/g, "");
    out.push(cleaned);
  }
  return normalizeWhitespace(out.join("\n"));
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").trim();
}
