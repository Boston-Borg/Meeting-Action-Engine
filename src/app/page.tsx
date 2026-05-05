import Link from "next/link";
import { getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  title: string;
  source: string;
  occurred_at: string | null;
  created_at: string;
};

async function loadMeetings() {
  const sb = getServiceClient();
  const { data: meetings } = await sb
    .from("meetings")
    .select("id, title, source, occurred_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const ids = (meetings ?? []).map((m: Row) => m.id);
  let counts: Record<string, { open: number; total: number }> = {};
  if (ids.length) {
    const { data: items } = await sb
      .from("action_items")
      .select("meeting_id, status")
      .in("meeting_id", ids);
    for (const id of ids) counts[id] = { open: 0, total: 0 };
    for (const it of items ?? []) {
      const c = counts[it.meeting_id];
      if (!c) continue;
      c.total++;
      if (it.status === "pending") c.open++;
    }
  }
  return { meetings: (meetings ?? []) as Row[], counts };
}

export default async function Dashboard() {
  const { meetings, counts } = await loadMeetings();

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            Every meeting, every action — tracked.
          </p>
        </div>
        <Link
          href="/upload"
          className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
        >
          Upload transcript
        </Link>
      </div>

      {meetings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/15 dark:border-white/15 p-10 text-center text-sm text-black/60 dark:text-white/60">
          No meetings yet. Upload a transcript to get started.
        </div>
      ) : (
        <ul className="divide-y divide-black/10 dark:divide-white/10 rounded-lg border border-black/10 dark:border-white/10">
          {meetings.map((m) => {
            const c = counts[m.id] ?? { open: 0, total: 0 };
            return (
              <li key={m.id}>
                <Link
                  href={`/meetings/${m.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{m.title}</div>
                    <div className="mt-0.5 text-xs text-black/55 dark:text-white/55">
                      {new Date(m.created_at).toLocaleString()} · {m.source}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs">
                    <span
                      className={
                        c.open > 0
                          ? "rounded-full bg-amber-100 px-2 py-1 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                          : "rounded-full bg-emerald-100 px-2 py-1 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
                      }
                    >
                      {c.open} open / {c.total} total
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
