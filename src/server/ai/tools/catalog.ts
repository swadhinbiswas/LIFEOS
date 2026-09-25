/**
 * The AI tool catalogue (spec §8, ADR-076). This file is pure — no `ai` import, no services — so
 * the safety policy (`approvalFor`) and the settings UI can share the exact same list of tools and
 * risks without pulling the model runtime into a client bundle.
 *
 * `risk` is the security classification the approval policy reads:
 * - `read`        — runs freely
 * - `write`       — proposes; the user approves. A subset is auto-approvable (spec §8)
 * - `destructive` — always asks, and can never be auto-approved
 */

export type ToolRisk = "read" | "write" | "destructive";

export interface ToolSpec {
  name: string;
  /** Written for the model, not for a UI tooltip (spec §9.2): concise and unambiguous. */
  description: string;
  risk: ToolRisk;
  /** Only meaningful for `write`: spec §8 permits auto-approval for create-task / log-habit. */
  autoApprovable?: boolean;
}

export const TOOL_SPECS: readonly ToolSpec[] = [
  // --- read: runs freely ---------------------------------------------------
  {
    name: "search",
    description: "Search the user's cards and boards by title and return matching cards.",
    risk: "read",
  },
  {
    name: "get_daily_brief",
    description: "Today's brief: overdue, due-today and top cards, in the user's timezone.",
    risk: "read",
  },
  {
    name: "list_boards",
    description: "List the user's boards with their ids and names.",
    risk: "read",
  },
  {
    name: "get_board",
    description: "One board with its columns and cards.",
    risk: "read",
  },
  {
    name: "list_cards",
    description: "List cards, optionally filtered to a board, column or completion state.",
    risk: "read",
  },
  {
    name: "get_card",
    description: "One card by id, with its fields.",
    risk: "read",
  },
  {
    name: "list_jobs",
    description: "The job pipeline: each application with its company and current stage.",
    risk: "read",
  },
  {
    name: "get_pipeline_stats",
    description: "Job-pipeline funnel: stage counts, response rate and time in stage.",
    risk: "read",
  },
  {
    name: "get_trends",
    description:
      "Focus minutes, habit consistency and completed cards over a window, with the last seven days and the change against the seven before. Use it for questions about direction or whether something is improving.",
    risk: "read",
  },
  {
    name: "list_habits",
    description: "Habits with today's value, streak and recent days.",
    risk: "read",
  },
  {
    name: "list_goals",
    description: "Objectives with their derived progress and key results.",
    risk: "read",
  },
  {
    name: "get_note",
    description: "One note by id, including its markdown body.",
    risk: "read",
  },
  {
    name: "list_resumes",
    description: "The user's CVs, with their derived checklist score and share state.",
    risk: "read",
  },
  {
    name: "get_resume",
    description: "One CV by id, as a JSON Resume document.",
    risk: "read",
  },
  {
    name: "propose_resume_edit",
    description:
      "Propose a new summary or headline for a CV. Returns the proposal and the current text; it never writes.",
    risk: "read",
  },

  // --- write: proposes, the user approves ---------------------------------
  {
    name: "create_card",
    description: "Create a task on the system Tasks board.",
    risk: "write",
    autoApprovable: true,
  },
  {
    name: "update_card",
    description: "Change a card's title, description, priority, estimate or due date.",
    risk: "write",
  },
  {
    name: "move_card",
    description: "Move a card to a named column on its board.",
    risk: "write",
  },
  {
    name: "complete_card",
    description: "Mark a card complete (moves it to the board's done column).",
    risk: "write",
  },
  {
    name: "create_note",
    description: "Create a note with a title and markdown body.",
    risk: "write",
  },
  {
    name: "append_to_daily_note",
    description: "Append markdown to today's journal note.",
    risk: "write",
  },
  {
    name: "run_weekly_review",
    description: "Draft a weekly review note from the user's cards and notes.",
    risk: "write",
  },
  {
    name: "log_habit",
    description: "Log a value for a habit on a day.",
    risk: "write",
    autoApprovable: true,
  },
  {
    name: "update_goal_progress",
    description: "Set a key result's current value.",
    risk: "write",
  },
  {
    name: "add_job_application",
    description: "Add a job application to the pipeline.",
    risk: "write",
  },
  {
    name: "update_job_stage",
    description: "Move a job application to a new pipeline stage.",
    risk: "write",
  },
  {
    name: "log_interview",
    description: "Record an interview round for a job application.",
    risk: "write",
  },
  {
    name: "start_focus_session",
    description: "Start a focus timer, optionally with a planned duration in minutes.",
    risk: "write",
  },
  {
    name: "add_transaction",
    description: "Record a finance transaction on an account.",
    risk: "write",
  },
  {
    name: "create_board_from_template",
    description: "Create a new board from a template.",
    risk: "write",
  },

  // --- destructive: never auto-approvable ---------------------------------
  {
    name: "delete_card",
    description: "Move a card to the trash.",
    risk: "destructive",
  },
];

/** Names a user may add to their auto-approve allowlist (spec §8: low-risk writes only). */
export const AUTO_APPROVABLE_TOOLS: readonly string[] = TOOL_SPECS.filter(
  (tool) => tool.autoApprovable === true,
).map((tool) => tool.name);

export function findToolSpec(name: string): ToolSpec | undefined {
  return TOOL_SPECS.find((tool) => tool.name === name);
}
