import { AI_CONTEXT_LIMITS } from "@/config/ai";
import { listBoards } from "@/server/boards";
import { listGoals } from "@/server/goals";
import { listHabits } from "@/server/habits";
import { getRegionalSettings } from "@/server/settings";

import { untrusted } from "./prompt";

/**
 * The compact, always-fresh user context injected server-side (spec §8, ADR-077). It is small by
 * design — a handful of names and numbers, never whole documents — and it is wrapped as untrusted
 * data so the model treats it as facts about the user, not as instructions.
 */
export async function buildUserContext(userId: string): Promise<string> {
  const [{ timeZone, weekStart }, boards, goals, habits] = await Promise.all([
    getRegionalSettings(userId),
    listBoards(userId),
    listGoals(userId),
    listHabits(userId),
  ]);

  const activeGoals = goals.filter((goal) => goal.goal.status === "active");
  const lines = [
    `today: ${new Date().toISOString().slice(0, 10)}`,
    `timezone: ${timeZone}; week starts ${weekStart === "mon" ? "Monday" : "Sunday"}`,
    `boards: ${boards
      .slice(0, AI_CONTEXT_LIMITS.cards)
      .map((board) => `${board.name}${board.is_system ? " (system)" : ""}`)
      .join(", ")}`,
    `active goals: ${activeGoals
      .slice(0, AI_CONTEXT_LIMITS.goals)
      .map((goal) => `${goal.goal.title} (${goal.progress}%)`)
      .join("; ")}`,
    `habits: ${habits
      .slice(0, AI_CONTEXT_LIMITS.habits)
      .map((row) => `${row.habit.name}${row.value > 0 ? " done today" : ""}`)
      .join("; ")}`,
  ];

  return untrusted("user_context", lines.join("\n"));
}
