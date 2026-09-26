"use server";

import { ZodError } from "zod";

import { BoardError } from "@/server/boards";
import type { ActionResult } from "@/server/boards/actions";
import { getServerSession } from "@/server/auth/session";
import {
  createContact,
  listContacts,
  listOwedContacts,
  updateContactFollowUp,
  type ContactRow,
  type OwedContact,
} from "@/server/contacts";

/** Server Actions for the people queue (spec §7.2). */
async function run<T>(fn: (userId: string) => Promise<T>): Promise<ActionResult<T>> {
  const session = await getServerSession();
  if (!session) return { ok: false, code: "unauthorized", message: "you are signed out" };
  try {
    return { ok: true, data: await fn(session.user.id) };
  } catch (error) {
    if (error instanceof BoardError) return { ok: false, code: error.code, message: error.message };
    if (error instanceof ZodError) {
      return { ok: false, code: "invalid", message: "that input is not valid" };
    }
    console.error("[contacts] action failed", error);
    return { ok: false, code: "invalid", message: "something went wrong — please retry" };
  }
}

export async function listContactsAction(): Promise<ActionResult<ContactRow[]>> {
  return run((userId) => listContacts(userId));
}

export async function listOwedContactsAction(): Promise<ActionResult<OwedContact[]>> {
  return run((userId) => listOwedContacts(userId));
}

export async function updateContactFollowUpAction(
  input_: unknown,
): Promise<ActionResult<ContactRow>> {
  return run(async (userId) => {
    const parsed = input_ as { contactId?: unknown; followUpAt?: unknown; contacted?: unknown };
    if (typeof parsed.contactId !== "string" || parsed.contactId === "") {
      throw new BoardError("invalid", "a contact is required");
    }
    // `null` is a real answer — the promise is kept — so it is allowed through rather than treated
    // as "missing" and leaving the row owed forever.
    const followUpAt =
      parsed.followUpAt === null || parsed.followUpAt === undefined
        ? null
        : new Date(parsed.followUpAt as string | number);
    if (followUpAt !== null && Number.isNaN(followUpAt.getTime())) {
      throw new BoardError("invalid", "that date is not valid");
    }
    return updateContactFollowUp(userId, {
      contactId: parsed.contactId,
      followUpAt,
      contacted: parsed.contacted === false ? false : true,
    });
  });
}

export async function createContactAction(input_: unknown): Promise<ActionResult<ContactRow>> {
  return run(async (userId) => {
    const parsed = input_ as { name?: unknown; title?: unknown; email?: unknown };
    const name = typeof parsed.name === "string" ? parsed.name.trim() : "";
    if (name === "") throw new BoardError("invalid", "a name is required");
    return createContact(userId, {
      name,
      title: typeof parsed.title === "string" ? parsed.title : null,
      email: typeof parsed.email === "string" ? parsed.email : null,
    });
  });
}
