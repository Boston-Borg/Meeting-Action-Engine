"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Choose a .txt, .vtt, or .docx file first.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (title.trim()) fd.append("title", title.trim());
      const resp = await fetch("/api/process-transcript", { method: "POST", body: fd });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Upload failed");
      router.push(`/meetings/${json.meeting_id}`);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload transcript</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Accepts <code>.txt</code>, <code>.vtt</code>, or <code>.docx</code>.
          We&apos;ll extract decisions, action items, and open questions.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Meeting title (optional)</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Q3 Planning sync"
            className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Transcript file</span>
          <input
            type="file"
            accept=".txt,.vtt,.docx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-black file:px-3 file:py-2 file:text-white hover:file:bg-black/80 dark:file:bg-white dark:file:text-black"
          />
        </label>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {busy ? "Processing…" : "Process transcript"}
        </button>
      </form>
    </div>
  );
}
