"use client";

import Link from "next/link";
import { useState } from "react";
import type { ActionItem, ActionStatus } from "@/types/db";

type Row = ActionItem & { meeting_title: string };

export default function OwnerActionList({ items }: { items: Row[] }) {
  const [rows, setRows] = useState(items);
  const [errorId, setErrorId] = useState<string | null>(null);

  async function setStatus(id: string, status: ActionStatus) {
    setErrorId(null);
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    try {
      const resp = await fetch(`/api/action-items/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!resp.ok) throw new Error(await resp.text());
    } catch {
      setRows(prev);
      setErrorId(id);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-black/15 dark:border-white/15 px-4 py-6 text-sm text-black/55 dark:text-white/55">
        No action items.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((a) => {
        const done = a.status === "completed";
        const overdue =
          !done && a.deadline && new Date(a.deadline) < new Date();
        return (
          <li
            key={a.id}
            className="flex items-start gap-3 rounded-md border border-black/10 dark:border-white/10 p-4"
          >
            <input
              type="checkbox"
              checked={done}
              onChange={(e) => setStatus(a.id, e.target.checked ? "completed" : "pending")}
              className="mt-1 h-4 w-4 cursor-pointer accent-black dark:accent-white"
            />
            <div className="min-w-0 flex-1">
              <div className={done ? "font-medium line-through opacity-60" : "font-medium"}>
                {a.task}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-black/65 dark:text-white/65">
                <Link
                  href={`/meetings/${a.meeting_id}`}
                  className="hover:underline"
                >
                  From: <span className="font-medium">{a.meeting_title}</span>
                </Link>
                {a.deadline && (
                  <span className={overdue ? "text-red-600 dark:text-red-400 font-medium" : ""}>
                    Due {a.deadline}
                    {overdue ? " (overdue)" : ""}
                  </span>
                )}
                {a.completed_at && (
                  <span>Completed {new Date(a.completed_at).toLocaleDateString()}</span>
                )}
              </div>
              {a.source_quote && (
                <blockquote className="mt-2 border-l-2 border-black/20 pl-3 text-xs italic text-black/60 dark:border-white/20 dark:text-white/60">
                  &ldquo;{a.source_quote}&rdquo;
                </blockquote>
              )}
              {errorId === a.id && (
                <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                  Failed to update — try again.
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
