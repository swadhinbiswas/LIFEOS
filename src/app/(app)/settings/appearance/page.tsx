import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/server/auth";

import { ThemeCustomizer } from "../_components/theme-customizer";

export const metadata = { title: "Appearance" };

/**
 * Appearance (spec §4.2/§13): every customizer axis, live and persisted per user (ADR-024).
 * The session re-check here satisfies ADR-026 for this route.
 */
export default async function AppearancePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">Appearance</h1>
      <ThemeCustomizer />
    </>
  );
}
