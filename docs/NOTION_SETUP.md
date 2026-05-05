# Notion Integration — Setup Guide

This guide walks through connecting your Notion workspace so that every
action item extracted from a meeting transcript is automatically created
as a row in a Notion database. Status changes (checking the box in the
app) sync back to Notion.

Total time: ~10 minutes.

---

## Step 1 — Create a Notion integration

1. Go to <https://www.notion.so/my-integrations>
2. Click **+ New integration**
3. Name it `Action Engine` (or whatever you like)
4. Associated workspace: pick your personal workspace
5. Type: **Internal**
6. Click **Save**
7. On the next screen, copy the **Internal Integration Secret** (starts with `ntn_` or `secret_`). Keep this tab open — you'll need it in Step 4.

---

## Step 2 — Create the database

1. In Notion, create a new page in your workspace called `Action Items`
2. Inside the page, type `/database` and pick **Database — Full page**
3. Set up these properties **with these exact names** (case sensitive):

| Property name     | Type      | Notes                                                  |
|-------------------|-----------|--------------------------------------------------------|
| `Task`            | Title     | This is the default first column — just rename it      |
| `Owner`           | Text      |                                                        |
| `Deadline`        | Date      |                                                        |
| `Status`          | Select    | Add three options: `Pending`, `Completed`, `Cancelled` |
| `Source Meeting`  | Text      |                                                        |
| `Source Quote`    | Text      |                                                        |

> The names must match exactly. If you want different names later, you'd
> edit `src/lib/notion.ts` to use yours.

---

## Step 3 — Share the database with your integration

This is the step everyone forgets. Without it, the API will return a
404 even though everything else is correct.

1. Open the `Action Items` database page
2. Click the **`···`** menu in the top-right
3. Click **Connections** → **Connect to**
4. Search for `Action Engine` and select it
5. Confirm the access prompt

---

## Step 4 — Get the database ID

1. In Notion, open the database as a full page
2. Look at the URL — it looks like:
   ```
   https://www.notion.so/<workspace>/abc123def4567890abcdef1234567890?v=...
   ```
3. The 32-character string between the last `/` and the `?` is your database ID. Copy it.

---

## Step 5 — Add credentials to `.env.local`

Open `~/Desktop/ai-meeting-action-engine/.env.local` and add two lines:

```
NOTION_API_KEY=ntn_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_DATABASE_ID=abc123def4567890abcdef1234567890
```

Then **stop and restart** your dev server (`Ctrl+C`, then `npm run dev`)
so Next.js picks up the new env vars.

---

## Step 6 — Run the database migration

The integration needs one new column on `action_items` to track the
Notion page id. In Supabase → SQL Editor → New query, paste and run:

```sql
alter table public.action_items
  add column if not exists notion_page_id text;
```

(This is also baked into `supabase/schema.sql` for fresh installs.)

---

## Step 7 — Test

1. Upload a transcript via the app at <http://localhost:3000/upload>
2. Open your `Action Items` database in Notion
3. You should see one new row per action item, each with the meeting
   title in the `Source Meeting` column
4. Back in the app, check off an action item — refresh Notion and the
   `Status` should flip to `Completed`

If the Notion side stays empty, check your terminal where `npm run dev`
is running. The integration logs errors as `[notion] create page failed`
with the API's response, which usually points at either:

- `unauthorized` → wrong key
- `object_not_found` → database not shared with the integration (Step 3)
- `validation_error` → a property name doesn't match (Step 2)

---

## Production deploy (Render)

When you deploy, add the same two env vars in your Render service's
**Environment** tab. Treat the integration secret like any other API key —
never commit it to git. (`.env.local` is already gitignored.)
