// =====================================================================
// Database row types — keep in sync with supabase/schema.sql
// =====================================================================

export type ActionStatus = "pending" | "completed" | "cancelled";
export type MeetingSource = "upload" | "zoom" | "teams" | "email";

export interface Meeting {
  id: string;
  title: string;
  source: MeetingSource;
  source_ref: string | null;
  transcript: string;
  occurred_at: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface Decision {
  id: string;
  meeting_id: string;
  decision: string;
  rationale: string | null;
  source_quote: string | null;
  confidence: number | null;
  created_at: string;
}

export interface ActionItem {
  id: string;
  meeting_id: string;
  task: string;
  owner: string | null;
  deadline: string | null;          // ISO date string (YYYY-MM-DD)
  status: ActionStatus;
  source_quote: string | null;
  confidence: number | null;
  completed_at: string | null;
  last_reminded_at: string | null;
  notion_page_id: string | null;
  created_at: string;
}

export interface OpenQuestion {
  id: string;
  meeting_id: string;
  question: string;
  context: string | null;
  source_quote: string | null;
  created_at: string;
}

export interface MeetingDetail extends Meeting {
  decisions: Decision[];
  action_items: ActionItem[];
  open_questions: OpenQuestion[];
}
