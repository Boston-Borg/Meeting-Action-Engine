import { getServiceClient } from "./supabase";
import type { ActionItem } from "../types/db";

// =====================================================================
// Reminder system (MVP).
// Strategy: every run, find pending action items that are
//   (a) overdue OR due in <= 2 days, AND
//   (b) haven't been reminded in the last 24h.
// Fire `sendReminder()` for each — currently console.log, swap for
// SendGrid / Postmark / Slack / Twilio later.
// =====================================================================

export type Reminder = {
  actionItem: ActionItem;
  reason: "overdue" | "due_soon";
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TWO_DAYS_MS = 2 * ONE_DAY_MS;

export async function findRemindersDue(now: Date = new Date()): Promise<Reminder[]> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("action_items")
    .select("*")
    .eq("status", "pending")
    .not("deadline", "is", null);
  if (error) throw error;

  const out: Reminder[] = [];
  for (const row of (data ?? []) as ActionItem[]) {
    if (!row.deadline) continue;
    const due = new Date(row.deadline + "T23:59:59Z").getTime();
    const diff = due - now.getTime();
    const lastReminded = row.last_reminded_at ? new Date(row.last_reminded_at).getTime() : 0;
    const remindedRecently = now.getTime() - lastReminded < ONE_DAY_MS;
    if (remindedRecently) continue;

    if (diff < 0) out.push({ actionItem: row, reason: "overdue" });
    else if (diff <= TWO_DAYS_MS) out.push({ actionItem: row, reason: "due_soon" });
  }
  return out;
}

/**
 * Placeholder delivery. Replace the body with a real channel:
 *   - Email: SendGrid / Postmark / Resend
 *   - Slack: chat.postMessage
 *   - SMS:   Twilio messages.create
 */
export async function sendReminder(r: Reminder): Promise<void> {
  const { actionItem: a, reason } = r;
  // eslint-disable-next-line no-console
  console.log(
    `[reminder] ${reason.toUpperCase()}  owner=${a.owner ?? "unassigned"}  ` +
      `due=${a.deadline}  task="${a.task}"  (action_item ${a.id})`,
  );
}

export async function runReminderSweep(): Promise<{ sent: number }> {
  const sb = getServiceClient();
  const due = await findRemindersDue();
  let sent = 0;
  for (const r of due) {
    await sendReminder(r);
    await sb
      .from("action_items")
      .update({ last_reminded_at: new Date().toISOString() })
      .eq("id", r.actionItem.id);
    sent++;
  }
  return { sent };
}
