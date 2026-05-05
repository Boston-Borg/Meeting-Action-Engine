import Link from "next/link";
import { getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Person = {
  displayName: string;
  open: number;
  overdue: number;
  soonest: string | null;
};

async function loadPeople(): Promise<Person[]> {
  const sb = getServiceClient();
  const { data } = await sb
    .from("action_items")
    .select("owner, deadline, status")
    .eq("status", "pending");

  const today = new Date().toISOString().slice(0, 10);
  const buckets = new Map<string, Person>();

  for (const row of data ?? []) {
    const ownerRaw = (row.owner ?? "").trim();
    if (!ownerRaw) continue;
    const key = ownerRaw.toLowerCase();
    const b = buckets.get(key) ?? {
      displayName: ownerRaw,
      open: 0,
      overdue: 0,
      soonest: null,
    };
    b.open += 1;
    if (row.deadline && row.deadline < today) b.overdue += 1;
    if (row.deadline) {
      if (!b.soonest || row.deadline < b.soonest) b.soonest = row.deadline;
    }
    buckets.set(key, b);
  }

  return Array.from(buckets.values()).sort((a, b) => {
    if (b.overdue !== a.overdue) return b.overdue - a.overdue;
    const aDate = a.soonest ?? "9999-12-31";
    const bDate = b.soonest ?? "9999-12-31";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return a.displayName.localeCompare(b.displayName);
  });
}

export default async function PeopleDashboard() {
  const people = await loadPeople();

  const totalOpen = people.reduce((s, p) => s + p.open, 0);
  const totalOverdue = people.reduce((s, p) => s + p.overdue, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">People</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Open action items grouped by owner.{" "}
          {totalOverdue > 0 ? (
            <span className="font-medium text-red-600 dark:text-red-400">
              {totalOverdue} overdue across {people.length} owner
              {people.length === 1 ? "" : "s"}.
            </span>
          ) : (
            <span>{totalOpen} open across {people.length} owner{people.length === 1 ? "" : "s"}.</span>
          )}
        </p>
      </div>

      {people.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/15 dark:border-white/15 p-10 text-center text-sm text-black/60 dark:text-white/60">
          No assigned action items yet. Upload a meeting transcript to populate this view.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {people.map((p) => (
            <li key={p.displayName.toLowerCase()}>
              <Link
                href={`/people/${encodeURIComponent(p.displayName)}`}
                className="block rounded-lg border border-black/10 dark:border-white/10 p-4 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="truncate text-base font-semibold">
                    {p.displayName}
                  </div>
                  {p.overdue > 0 && (
                    <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-950/60 dark:text-red-200">
                      {p.overdue} overdue
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/65 dark:text-white/65">
                  <span>{p.open} open</span>
                  {p.soonest && <span>Soonest due {p.soonest}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
