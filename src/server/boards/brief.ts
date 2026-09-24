import { DEFAULT_TIME_ZONE, dayKeyInTimeZone } from "@/lib/timezone";
import { ensureSystemTasksBoard, getBoard, moveCard, type Card } from "@/server/boards";

/**
 * Daily brief + plan-my-day (spec §6.2): what is overdue, what is due today, what is still in
 * the inbox, the three things worth doing first, and how much estimated work today already
 * holds. Everything is derived from the board the user already has — no summary tables.
 *
 * "Today" is the user's calendar day (ADR-057), not UTC's, so a card due at 23:00 local is due
 * today wherever the user is.
 *
 * "Workload" is reported as the estimated minutes actually attached to today's cards. The spec
 * pairs it with a calendar and available hours; both arrive with the calendar module, and
 * inventing an hourly capacity now would be fabricated data (spec §1).
 */

export interface DailyBrief {
  overdue: Card[];
  dueToday: Card[];
  inbox: Card[];
  /** Overdue, open, and not already in Today — what `carryOverOverdue` would move. */
  carryEligible: Card[];
  /** Up to three open cards: priority first, then the nearest due date. */
  top: Card[];
  estimatedMinutesToday: number;
  openCards: number;
}

const PRIORITY_RANK: Record<string, number> = { p0: 0, p1: 1, p2: 2, p3: 3 };

const rank = (card: Card): number => PRIORITY_RANK[card.priority ?? ""] ?? 4;

const byPlanOrder = (a: Card, b: Card): number => {
  const priority = rank(a) - rank(b);
  if (priority !== 0) return priority;
  const aDue = a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER;
  const bDue = b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER;
  if (aDue !== bDue) return aDue - bDue;
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
};

/**
 * Overdue, open, and not already in Today, oldest due first. One definition shared by the
 * brief and the carry-over so the number on the button is exactly what the key would move.
 * Carry-over deliberately does **not** rewrite the due date: moving yesterday's work into
 * today's plan must not falsify when it was due.
 */
function carryEligibleCards(
  payload: { cards: Card[]; columns: Array<{ id: string; name: string }> },
  today: string,
  timeZone: string,
): Card[] {
  const todayColumn = payload.columns.find((column) => column.name === "Today");
  return payload.cards
    .filter(
      (card) =>
        card.completed_at === null &&
        card.column_id !== todayColumn?.id &&
        card.due_at !== null &&
        dayKeyInTimeZone(new Date(card.due_at), timeZone) < today,
    )
    .sort((a, b) => new Date(a.due_at ?? 0).getTime() - new Date(b.due_at ?? 0).getTime());
}

export async function getDailyBrief(
  userId: string,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): Promise<DailyBrief> {
  const board = await ensureSystemTasksBoard(userId);
  const payload = await getBoard(userId, board.id);
  const today = dayKeyInTimeZone(now, timeZone);

  const open = payload.cards.filter((card) => card.completed_at === null);
  const dueToday = open.filter(
    (card) => card.due_at !== null && dayKeyInTimeZone(new Date(card.due_at), timeZone) === today,
  );
  const overdue = open.filter(
    (card) => card.due_at !== null && dayKeyInTimeZone(new Date(card.due_at), timeZone) < today,
  );
  const inboxColumn = payload.columns.find((column) => column.name === "Inbox");
  const inbox = inboxColumn ? open.filter((card) => card.column_id === inboxColumn.id) : [];
  const todayColumn = payload.columns.find((column) => column.name === "Today");

  const todayIds = new Set([
    ...dueToday.map((card) => card.id),
    ...(todayColumn
      ? open.filter((card) => card.column_id === todayColumn.id).map((c) => c.id)
      : []),
  ]);
  const estimatedMinutesToday = open
    .filter((card) => todayIds.has(card.id))
    .reduce((total, card) => total + (card.estimate_min ?? 0), 0);

  return {
    overdue,
    dueToday,
    inbox,
    carryEligible: carryEligibleCards(payload, today, timeZone),
    top: [...open].sort(byPlanOrder).slice(0, 3),
    estimatedMinutesToday,
    openCards: open.length,
  };
}

/**
 * Carry-over (spec §6.2: "carry-over of unfinished tasks with one key (c)"): move every open,
 * overdue card into the Today column, appended in due order so the oldest debt is at the top.
 * Every move goes through `moveCard`, so version checks and the ADR-009 key retry apply here
 * exactly as they do for a drag. Returns how many cards moved.
 */
export async function carryOverOverdue(
  userId: string,
  now: Date = new Date(),
  timeZone: string = DEFAULT_TIME_ZONE,
): Promise<number> {
  const board = await ensureSystemTasksBoard(userId);
  const payload = await getBoard(userId, board.id);
  const todayColumn = payload.columns.find((column) => column.name === "Today");
  if (!todayColumn) return 0;

  const overdue = carryEligibleCards(payload, dayKeyInTimeZone(now, timeZone), timeZone);
  if (overdue.length === 0) return 0;

  let previousId: string | null = null;
  for (const card of overdue) {
    await moveCard(userId, {
      cardId: card.id,
      version: card.version,
      toColumnId: todayColumn.id,
      prevCardId: previousId,
      nextCardId: null,
    });
    previousId = card.id;
  }

  return overdue.length;
}
