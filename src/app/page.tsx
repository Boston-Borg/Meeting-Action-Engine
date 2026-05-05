"use client";

import { useState } from "react";

type Decision = {
  decision: string;
  rationale: string | null;
  source_quote: string | null;
  confidence: number | null;
};

type ActionItem = {
  task: string;
  owner: string | null;
  deadline: string | null;
  source_quote: string | null;
  confidence: number | null;
};

type OpenQuestion = {
  question: string;
  context: string | null;
  source_quote: string | null;
};

type Result = {
  title: string;
  decisions: Decision[];
  action_items: ActionItem[];
  open_questions: OpenQuestion[];
  notion: { configured: boolean; pushed: number };
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

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
      const resp = await fetch("/api/process-transcript", {
        method: "POST",
        body: fd,
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || "Upload failed");
      setResult(json as Result);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setResult(null);
    setFile(null);
    setTitle("");
    setError(null);
  }

  if (result) {
    return <Results result={result} onReset={reset} />;
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          AI Meeting → Action Engine
        </h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">
          Upload a meeting transcript and Claude will extract the decisions,
          action items, and open questions. Action items are pushed to Notion
          if configured. Nothing is stored on the server — every upload is
          processed fresh and forgotten.
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

function Results({ result, onReset }: { result: Result; onReset: () => void }) {
  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{result.title}</h1>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Extracted just now · processed in memory · not stored on the server
          </p>
        </div>
        <button
          onClick={onReset}
          className="shrink-0 rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/[0.04] dark:border-white/15 dark:hover:bg-white/[0.06]"
        >
          ← New upload
        </button>
      </div>

      {result.notion.configured && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          ✓ {result.notion.pushed} of {result.action_items.length} action item
          {result.action_items.length === 1 ? "" : "s"} synced to Notion.
        </div>
      )}

      <Section title={`Decisions (${result.decisions.length})`}>
        {result.decisions.length === 0 ? (
          <Empty>No decisions identified.</Empty>
        ) : (
          <ul className="space-y-3">
            {result.decisions.map((d, i) => (
              <li
                key={i}
                className="rounded-md border border-black/10 dark:border-white/10 p-4"
              >
                <div className="font-medium">{d.decision}</div>
                {d.rationale && (
                  <div className="mt-1 text-sm text-black/65 dark:text-white/65">
                    {d.rationale}
                  </div>
                )}
                {d.source_quote && <Quote text={d.source_quote} />}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Action items (${result.action_items.length})`}>
        {result.action_items.length === 0 ? (
          <Empty>No action items identified.</Empty>
        ) : (
          <ul className="space-y-3">
            {result.action_items.map((a, i) => (
              <li
                key={i}
                className="rounded-md border border-black/10 dark:border-white/10 p-4"
              >
                <div className="font-medium">{a.task}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-black/65 dark:text-white/65">
                  {a.owner && <span>Owner: <span className="font-medium">{a.owner}</span></span>}
                  {a.deadline && <span>Due {a.deadline}</span>}
                </div>
                {a.source_quote && <Quote text={a.source_quote} />}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Open questions (${result.open_questions.length})`}>
        {result.open_questions.length === 0 ? (
          <Empty>No unresolved questions.</Empty>
        ) : (
          <ul className="space-y-3">
            {result.open_questions.map((q, i) => (
              <li
                key={i}
                className="rounded-md border border-black/10 dark:border-white/10 p-4"
              >
                <div className="font-medium">{q.question}</div>
                {q.context && (
                  <div className="mt-1 text-sm text-black/65 dark:text-white/65">
                    {q.context}
                  </div>
                )}
                {q.source_quote && <Quote text={q.source_quote} />}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-black/15 dark:border-white/15 px-4 py-6 text-sm text-black/55 dark:text-white/55">
      {children}
    </div>
  );
}

function Quote({ text }: { text: string }) {
  return (
    <blockquote className="mt-2 border-l-2 border-black/20 pl-3 text-xs italic text-black/60 dark:border-white/20 dark:text-white/60">
      &ldquo;{text}&rdquo;
    </blockquote>
  );
}
