import Link from "next/link";
import { notFound } from "next/navigation";
import { getServiceClient } from "@/lib/supabase";
import type { ActionItem } from "@/types/db";
import OwnerActionList from "./OwnerActionList";

export const dynamic = "force-dynamic";

type Row = ActionItem & { meeting_title: string };

async function loadOwnerItems(name: string): Promise<{
  displayName: string;
  items: Row[];
} | null> {
  const sb = getServiceClient();

  // ilike '<name>' is case-insensitive exact match.
  // Owners are free-text, so we trim and compare case-insensitively.
  const { data, error } = await sb
    .from("action_items")
    .select("*, meetings:meeting_id(title)")
    .ilike("owner", name.trim());

  if (error) return null;
  if (!data || data.length === 0) return null;

  const items: Row[] = data.map((r: any) => ({
    id: r.id,
    meeting_id: r.meeting_id,
    task: r.task,
    owner: r.owner,
    deadline: r.deadline,
    status: r.status,
    source_quote: r.source_quote,
    confidence: r.confidence,
    completed_at: r.completed_at,
    last_reminded_at: r.last_reminded_at,
    notion_page_id: r.notion_page_id ?? null,
    created_at: r.created_at,
    meeting_title: r.meetings?.title ?? "Untitled meeting",
  }));

  // Sort: pending first (by deadline asc, nulls last), then completed (by completed_at desc)
  items.sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    if (a.status === "pending") {
      const aD = a.deadline ?? "9999-12-31";
      const bD = b.deadline ?? "9999-12-31";
      return aD.localeCompare(bD);
    }
    return (b.completed_at ?? "").localeCompare(a.completed_at ?? "");
  });

  return { displayName: items[0]?.owner ?? name, items };
}

export default async function OwnerDetailPage({
  params,
}: {
  params: { name: string };
}) {
  const decoded = decodeURIComponent(params.name);
  const data = await loadOwnerItems(decoded);
  if (!data) return notFound();

  const open = data.items.filter((i) => i.status === "pending").length;
  const overdue = data.items.filter(
    (i) =>
      i.status === "pending" &&
      i.deadline &&
      new Date(i.deadline) < new Date(),
  ).length;
  const completed = data.items.filter((i) => i.status === "completed").length;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/people"
          className="text-xs text-black/55 dark:text-white/55 hover:underline"
        >
          ← All people
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {data.displayName}
        </h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          {open} open · {overdue} overdue · {completed} completed
        </p>
      </div>

      <OwnerActionList items={data.items} />
    </div>
  );
}
