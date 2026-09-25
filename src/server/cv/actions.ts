"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { auth } from "@/server/auth";

import {
  createResume,
  deleteResume,
  restoreVersion,
  saveVersion,
  seedResumeFromProfile,
  setShare,
  updateResume,
} from "./index";
import { cvDocumentSchema } from "./schema";

/**
 * Server Actions for the CV builder (spec §6.3): thin adapters over `src/server/cv`, the single
 * writer. Every action re-checks the session and only ever touches the caller's rows.
 */

export type CvResult =
  { ok: true; id?: string; slug?: string | null } | { ok: false; message: string };

async function userId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

export async function createBlankCvAction(): Promise<CvResult> {
  const id = await userId();
  if (!id) return { ok: false, message: "you are signed out" };
  const { id: resumeId } = await createResume(id, { title: "Untitled CV" });
  revalidatePath("/career/cv");
  return { ok: true, id: resumeId };
}

export async function createCvFromProfileAction(): Promise<CvResult> {
  const id = await userId();
  if (!id) return { ok: false, message: "you are signed out" };
  const { id: resumeId } = await seedResumeFromProfile(id);
  revalidatePath("/career/cv");
  return { ok: true, id: resumeId };
}

export async function saveCvAction(input: {
  id: string;
  title: string;
  document: unknown;
}): Promise<CvResult> {
  const id = await userId();
  if (!id) return { ok: false, message: "you are signed out" };

  const parsed = cvDocumentSchema.safeParse(input.document);
  if (!parsed.success) return { ok: false, message: "check the CV fields" };

  await updateResume(id, { id: input.id, title: input.title, document: parsed.data });
  revalidatePath(`/career/cv/${input.id}`);
  revalidatePath("/career/cv");
  return { ok: true };
}

export async function saveCvVersionAction(input: { id: string }): Promise<CvResult> {
  const id = await userId();
  if (!id) return { ok: false, message: "you are signed out" };
  const version = await saveVersion(id, input.id, "manual snapshot");
  if (!version) return { ok: false, message: "CV not found" };
  revalidatePath(`/career/cv/${input.id}`);
  return { ok: true };
}

export async function restoreCvVersionAction(input: {
  versionId: string;
  id: string;
}): Promise<CvResult> {
  const id = await userId();
  if (!id) return { ok: false, message: "you are signed out" };
  await restoreVersion(id, input.versionId);
  revalidatePath(`/career/cv/${input.id}`);
  return { ok: true };
}

export async function setCvShareAction(input: { id: string; enabled: boolean }): Promise<CvResult> {
  const id = await userId();
  if (!id) return { ok: false, message: "you are signed out" };
  const slug = await setShare(id, input.id, input.enabled);
  revalidatePath(`/career/cv/${input.id}`);
  return { ok: true, slug };
}

export async function deleteCvAction(input: { id: string }): Promise<CvResult> {
  const id = await userId();
  if (!id) return { ok: false, message: "you are signed out" };
  await deleteResume(id, input.id);
  revalidatePath("/career/cv");
  return { ok: true };
}
