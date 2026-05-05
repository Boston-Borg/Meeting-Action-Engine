// =====================================================================
// Notion integration
// ---------------------------------------------------------------------
// Pushes action items to a Notion database the user has shared with our
// integration. Designed to be best-effort: if NOTION_API_KEY or
// NOTION_DATABASE_ID are missing, every function silently no-ops so
// uploads keep working without Notion configured.
//
// Required Notion database properties (exact names, case-sensitive):
//   - "Task"           type: Title
//   - "Owner"          type: Text   (rich_text)
//   - "Deadline"       type: Date
//   - "Status"         type: Select   (options: Pending, Completed, Cancelled)
//   - "Source Meeting" type: Text   (rich_text)
//   - "Source Quote"   type: Text   (rich_text)
//
// See README for the step-by-step setup guide.
// =====================================================================

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function getConfig() {
  const key = process.env.NOTION_API_KEY;
  const dbId = process.env.NOTION_DATABASE_ID;
  if (!key || !dbId) return null;
  return { key, dbId };
}

/**
 * True when Notion env vars are present. Used by callers who want to
 * skip extra work (like awaiting status sync) when not configured.
 */
export function isNotionConfigured(): boolean {
  return getConfig() !== null;
}

// ---------------------------------------------------------------------
// Helpers for Notion's verbose property format
// ---------------------------------------------------------------------
function richText(value: string | null | undefined) {
  if (!value) return { rich_text: [] };
  // Notion has a 2000-char limit per text chunk
  const trimmed = value.length > 1900 ? value.slice(0, 1900) + "…" : value;
  return { rich_text: [{ text: { content: trimmed } }] };
}

function title(value: string) {
  return { title: [{ text: { content: value || "(untitled)" } }] };
}

function dateProp(value: string | null | undefined) {
  // value is YYYY-MM-DD or null
  if (!value) return { date: null };
  return { date: { start: value } };
}

function statusToNotion(status: "pending" | "completed" | "cancelled"): string {
  return status[0].toUpperCase() + status.slice(1);
}

// ---------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------
export type ActionItemForNotion = {
  task: string;
  owner?: string | null;
  deadline?: string | null;
  source_quote?: string | null;
  status?: "pending" | "completed" | "cancelled";
};

/**
 * Create a single page in the configured Notion database.
 * Returns the new page id, or null on failure / not configured.
 * Never throws — Notion problems should not block transcript processing.
 */
export async function pushActionItemToNotion(
  item: ActionItemForNotion,
  meetingTitle: string,
): Promise<string | null> {
  const cfg = getConfig();
  if (!cfg) return null;

  const body = {
    parent: { database_id: cfg.dbId },
    properties: {
      Task: title(item.task),
      Owner: richText(item.owner),
      Deadline: dateProp(item.deadline),
      Status: { select: { name: statusToNotion(item.status ?? "pending") } },
      "Source Meeting": richText(meetingTitle),
      "Source Quote": richText(item.source_quote),
    },
  };

  try {
    const resp = await fetch(`${NOTION_API}/pages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.key}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      // eslint-disable-next-line no-console
      console.warn(`[notion] create page failed (${resp.status}): ${text}`);
      return null;
    }

    const json = (await resp.json()) as { id?: string };
    return json.id ?? null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[notion] create page error:", err);
    return null;
  }
}

/**
 * Update the Status select on an existing Notion page.
 * Best-effort: returns false on failure but never throws.
 */
export async function updateNotionPageStatus(
  pageId: string,
  status: "pending" | "completed" | "cancelled",
): Promise<boolean> {
  const cfg = getConfig();
  if (!cfg) return false;

  const body = {
    properties: {
      Status: { select: { name: statusToNotion(status) } },
    },
  };

  try {
    const resp = await fetch(`${NOTION_API}/pages/${pageId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${cfg.key}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text();
      // eslint-disable-next-line no-console
      console.warn(`[notion] update page failed (${resp.status}): ${text}`);
      return false;
    }
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[notion] update page error:", err);
    return false;
  }
}
