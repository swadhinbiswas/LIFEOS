import type { ReactNode } from "react";

import { billingReady } from "@/env";

import { SettingsNav } from "./_components/settings-nav";

/**
 * Settings shell (reference anatomy): a section nav beside the content. The billing section only
 * exists when billing is ready (ADR-082), so no link ever leads to a hidden feature.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  const items = [
    { href: "/settings", key: "profile" },
    { href: "/settings/appearance", key: "appearance" },
    { href: "/settings/integrations", key: "integrations" },
    { href: "/settings/ai", key: "aiSettings" },
    { href: "/settings/data", key: "data" },
    ...(billingReady ? [{ href: "/settings/billing", key: "billing" }] : []),
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <SettingsNav items={items} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
