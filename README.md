# AI Meeting → Action Engine

Convert meeting transcripts into structured, accountable outcomes.
This is **not a note-taking app** — it's an **accountability system**:
every action has an owner, a deadline, a source quote, and a status that
gets tracked over time.

---

## 1. Architecture

```
┌──────────────┐     upload      ┌────────────────────┐
│   Browser    │ ───────────────▶│  Next.js (App Rt.) │
│ (Upload UI)  │                 │   /api/process-... │
└──────────────┘                 └─────────┬──────────┘
                                           │ parsed text
                                           ▼
                                 ┌────────────────────┐
                                 │  LLM (JSON-mode)   │
                                 │  decisions /       │
                                 │  action_items /    │
                                 │  open_questions    │
                                 └─────────┬──────────┘
                                           │ validated JSON
                                           ▼
                                 ┌────────────────────┐
                                 │  Supabase Postgres │
                                 │  meetings,         │
                                 │  action_items,     │
                                 │  decisions,        │
                                 │  open_questions    │
                                 └─────────┬──────────┘
                                           │
                ┌──────────────────────────┼─────────────────────────┐
                ▼                          ▼                         ▼
      GET /api/meetings        GET /api/meetings/:id     PATCH /api/action-items/:id
      (Dashboard list)         (Meeting detail page)     (mark complete / reassign)
                                           │
                                           ▼
                                 ┌────────────────────┐
                                 │ Reminder Scheduler │
                                 │ (cron / placeholder│
                                 │  hooks: email/SMS) │
                                 └────────────────────┘
```

**Data flow**

1. User uploads `.txt`, `.vtt`, or `.docx` on `/upload`.
2. `POST /api/process-transcript` parses the file → plain text.
3. Plain text is sent to the LLM with a strict JSON schema prompt.
4. JSON is validated with Zod, then written into Supabase across 4 tables.
5. The dashboard (`/`) and detail page (`/meetings/:id`) read from Supabase.
6. A reminder worker scans `action_items` daily and fires `sendReminder()`
   stubs that you can later wire to email / Slack / SMS.

---

## 2. Database Schema

See `supabase/schema.sql`. Four tables, all referencing `meetings(id)`:

- `meetings` — uploaded transcript metadata
- `decisions` — what was decided + source quote
- `action_items` — task, owner, deadline, status, source quote, confidence
- `open_questions` — unresolved questions raised in the meeting

Action items are the heart of the accountability model — every row carries
its `source_quote` so you can always trace it back to the transcript.

---

## 3. Setup

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env.local
# fill in:
#   NEXT_PUBLIC_SUPABASE_URL
#   NEXT_PUBLIC_SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_ROLE_KEY   (server-only, used by API routes)
#   ANTHROPIC_API_KEY           (or OPENAI_API_KEY — see src/lib/llm.ts)

# 3. Create the database
# In Supabase SQL editor, paste & run:  supabase/schema.sql

# 4. Run dev server
npm run dev
# open http://localhost:3000
```

### Connecting Supabase

1. Create a project at https://supabase.com.
2. Project Settings → API → copy the URL, anon key, and service-role key
   into `.env.local`.
3. SQL Editor → paste `supabase/schema.sql` → Run.
4. Optional: enable Row Level Security later when you add auth.

### Running the reminder worker

```bash
npm run reminders   # one-shot scan; wire to cron / Vercel cron / GitHub Actions
```

---

## 4. Future Extensions

- **Zoom**: register a Zoom Marketplace app, subscribe to the
  `recording.completed` webhook, fetch the VTT, POST it to
  `/api/process-transcript` with `source: 'zoom'`.
- **Microsoft Teams**: use Graph API `callRecords` + `onlineMeetings/{id}/transcripts`,
  same downstream pipeline.
- **Email ingestion**: point a forwarding address (e.g. via Postmark/SendGrid
  inbound) at `/api/ingest/email`, extract the transcript attachment, reuse
  the same processor.
- **Audio**: add a pre-step that runs Whisper on `.mp3`/`.m4a` uploads, then
  feeds the transcript into the existing pipeline.
- **Auth + multi-tenant**: turn on Supabase Auth, add an `org_id` column,
  enable RLS policies scoped to `auth.uid()`.

---

## File Map

```
ai-meeting-action-engine/
├── README.md
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
├── postcss.config.js
├── .env.example
├── supabase/
│   └── schema.sql
├── scripts/
│   └── run-reminders.ts
└── src/
    ├── app/
    │   ├── layout.tsx
    │   ├── globals.css
    │   ├── page.tsx                          # Dashboard
    │   ├── upload/page.tsx                   # Upload UI
    │   ├── meetings/[id]/page.tsx            # Meeting detail
    │   └── api/
    │       ├── process-transcript/route.ts
    │       ├── meetings/route.ts
    │       ├── meetings/[id]/route.ts
    │       └── action-items/[id]/route.ts
    ├── lib/
    │   ├── supabase.ts
    │   ├── llm.ts
    │   ├── parsers.ts
    │   ├── reminders.ts
    │   └── schema.ts                         # Zod schemas
    └── types/
        └── db.ts
```
