import { notFound } from "next/navigation";
import { getServiceClient } from "@/lib/supabase";
import type { MeetingDetail } from "@/types/db";
import ActionItemList from "./ActionItemList";

export const dynamic = "force-dynamic";

async function loadMeeting(id: string): Promise<MeetingDetail | null> {
  const sb = getServiceClient();
  const [m, d, a, q] = await Promise.all([
    sb.from("meetings").select("*").eq("id", id).single(),
    sb.from("decisions").select("*").eq("meeting_id", id).order("created_at"),
    sb.from("action_items").select("*").eq("meeting_id", id).order("created_at"),
    sb.from("open_questions").select("*").eq("meeting_id", id).order("created_at"),
  ]);
  if (m.error || !m.data) return null;
  return {
    ...m.data,
    decisions: d.data ?? [],
    action_items: a.data ?? [],
    open_questions: q.data ?? [],
  };
}

export default async function MeetingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const meeting = await loadMeeting(params.id);
  if (!meeting) return notFound();

  const open = meeting.action_items.filter((a) => a.status === "pending").length;
  const total = meeting.action_items.length;

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-black/55 dark:text-white/55">
          Meeting · {meeting.source}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{meeting.title}</h1>
        <div className="text-sm text-black/60 dark:text-white/60">
          Processed {meeting.processed_at ? new Date(meeting.processed_at).toLocaleString() : "—"}
          &nbsp;·&nbsp; {open} open / {total} total action items
        </div>
      </header>

      {/* DECISIONS */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/70 dark:text-white/70">
          Decisions
        </h2>
        {meeting.decisions.length === 0 ? (
          <EmptyHint>No decisions extracted.</EmptyHint>
        ) : (
          <ul className="space-y-3">
            {meeting.decisions.map((d) => (
              <li
                key={d.id}
                className="rounded-md border border-black/10 dark:border-white/10 p-4"
              >
                <div className="font-medium">{d.decision}</div>
                {d.rationale && (
                  <div className="mt-1 text-sm text-black/70 dark:text-white/70">
                    {d.rationale}
                  </div>
                )}
                {d.source_quote && <Quote text={d.source_quote} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ACTION ITEMS */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/70 dark:text-white/70">
          Action items
        </h2>
        {meeting.action_items.length === 0 ? (
          <EmptyHint>No action items extracted.</EmptyHint>
        ) : (
          <ActionItemList items={meeting.action_items} />
        )}
      </section>

      {/* OPEN QUESTIONS */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-black/70 dark:text-white/70">
          Open questions
        </h2>
        {meeting.open_questions.length === 0 ? (
          <EmptyHint>No open questions extracted.</EmptyHint>
        ) : (
          <ul className="space-y-3">
            {meeting.open_questions.map((q) => (
              <li
                key={q.id}
                className="rounded-md border border-black/10 dark:border-white/10 p-4"
              >
                <div className="font-medium">{q.question}</div>
                {q.context && (
                  <div className="mt-1 text-sm text-black/70 dark:text-white/70">
                    {q.context}
                  </div>
                )}
                {q.source_quote && <Quote text={q.source_quote} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
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
