import { and, asc, eq, isNotNull, lte } from "drizzle-orm";

import { newId } from "@/lib/id";
import { db } from "@/server/db";
import { companies, contacts } from "@/server/db/schema";
import { emitEvent } from "@/server/webhooks";

/**
 * The people side of the tracker (ADR-132).
 *
 * `contacts` existed, but only inside `/career/jobs` — a recruiter or a hiring manager attached to
 * an application. That is a *career* fact: it answers "who do I know at the company I applied to".
 * It cannot answer "who did I say I would call back?", and that is not a career question. A person
 * you owe something to is a person, whatever they are to you professionally.
 *
 * **`follow_up_at` is the promise; `last_contacted_at` is the fact.** The owed view reads the
 * promise, because "you have not spoken to Ravi in 19 days" is a much weaker and much noisier claim
 * than "you told Ravi you would send the portfolio by Friday". Absence of a promise is not a debt.
 */
export interface ContactRow {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  company: string | null;
  lastContactedAt: Date | null;
  followUpAt: Date | null;
}

export interface OwedContact extends ContactRow {
  /** Whole days past the promise. `0` means it is due today, which is not the same as overdue. */
  daysOverdue: number;
}

export async function listContacts(userId: string): Promise<ContactRow[]> {
  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      title: contacts.title,
      email: contacts.email,
      lastContactedAt: contacts.last_contacted_at,
      followUpAt: contacts.follow_up_at,
      company: companies.name,
    })
    .from(contacts)
    .leftJoin(companies, eq(companies.id, contacts.company_id))
    .where(eq(contacts.user_id, userId))
    .orderBy(asc(contacts.name));
  return rows;
}

/**
 * Promises that have come round.
 *
 * **Only a promise counts.** A contact with no `follow_up_at` is not owed anything, however long ago
 * you last spoke — that would be a guilt list dressed as a to-do list, and the fastest way to get
 * a person to stop opening the page.
 *
 * **`lte`, not `lt`:** a promise made for today is due today, and a "you are late" list that starts
 * tomorrow is a list that is wrong when you read it.
 */
export async function listOwedContacts(
  userId: string,
  now: Date = new Date(),
): Promise<OwedContact[]> {
  const rows = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      title: contacts.title,
      email: contacts.email,
      lastContactedAt: contacts.last_contacted_at,
      followUpAt: contacts.follow_up_at,
      company: companies.name,
    })
    .from(contacts)
    .leftJoin(companies, eq(companies.id, contacts.company_id))
    .where(
      and(
        eq(contacts.user_id, userId),
        isNotNull(contacts.follow_up_at),
        lte(contacts.follow_up_at, now),
      ),
    )
    // Most overdue first, because that is the order a queue is read in.
    .orderBy(asc(contacts.follow_up_at));

  return rows.map((row) => ({
    ...row,
    daysOverdue: row.followUpAt ? wholeDaysBetween(row.followUpAt, now) : 0,
  }));
}

/**
 * Mark a promise kept, or make a new one.
 *
 * `clearFollowUp` and `followUpAt` are mutually exclusive by construction at the call site: setting a
 * new date *is* keeping the old promise, and a row cannot be both owed and not owed. Doing it in one
 * update rather than two means there is no window in which the contact appears in neither list.
 */
export async function updateContactFollowUp(
  userId: string,
  input: {
    contactId: string;
    /** An instant to promise, or `null` to clear the promise. */
    followUpAt: Date | null;
    /** Whether to also record that the conversation happened. Defaults to true. */
    contacted?: boolean;
  },
): Promise<ContactRow> {
  const [existing] = await db
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, input.contactId), eq(contacts.user_id, userId)))
    .limit(1);
  if (!existing) throw new Error("contact not found");

  await db
    .update(contacts)
    .set({
      follow_up_at: input.followUpAt,
      // Recording the conversation is the default: the usual reason to clear a promise is that you
      // did the thing. It is a separate boolean so "spoken, and the promise stands" is expressible.
      ...(input.contacted === false ? {} : { last_contacted_at: new Date() }),
    })
    .where(and(eq(contacts.id, input.contactId), eq(contacts.user_id, userId)));

  await emitEvent(userId, "contact.follow_up_changed", {
    contactId: input.contactId,
    followUpAt: input.followUpAt?.toISOString() ?? null,
  });

  const [row] = await db
    .select({
      id: contacts.id,
      name: contacts.name,
      title: contacts.title,
      email: contacts.email,
      lastContactedAt: contacts.last_contacted_at,
      followUpAt: contacts.follow_up_at,
      company: companies.name,
    })
    .from(contacts)
    .leftJoin(companies, eq(companies.id, contacts.company_id))
    .where(and(eq(contacts.id, input.contactId), eq(contacts.user_id, userId)))
    .limit(1);
  if (!row) throw new Error("contact not found");
  return row;
}

export async function createContact(
  userId: string,
  input: { name: string; title?: string | null; email?: string | null; followUpAt?: Date | null },
): Promise<ContactRow> {
  const id = newId();
  await db.insert(contacts).values({
    id,
    user_id: userId,
    name: input.name.trim(),
    title: input.title ?? null,
    email: input.email ?? null,
    follow_up_at: input.followUpAt ?? null,
  });
  return {
    id,
    name: input.name.trim(),
    title: input.title ?? null,
    email: input.email ?? null,
    company: null,
    lastContactedAt: null,
    followUpAt: input.followUpAt ?? null,
  };
}

function wholeDaysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}
