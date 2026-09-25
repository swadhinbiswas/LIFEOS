"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Sends a signed-in account that has not finished onboarding to `/onboarding` once (ADR-085).
 *
 * Scoped to `/dashboard` — the place a new account lands — so it never hijacks a deliberate
 * navigation elsewhere or loops while the user is in the flow.
 */
export function OnboardingGate({ onboarded }: { onboarded: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!onboarded && pathname === "/dashboard") router.replace("/onboarding");
  }, [onboarded, pathname, router]);

  return null;
}
