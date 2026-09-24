import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Panel } from "@/components/tui/panel";
import { auth } from "@/server/auth";
import { getTimeZone } from "@/server/settings";

import { ProfileForm } from "./_components/profile-form";
import { TimeZoneForm } from "./_components/time-zone-form";

export const metadata = { title: "Profile" };

/**
 * Profile (spec §13 Phase 1 settings): the fields Better Auth owns today. Locale/timezone/
 * week-start columns exist (ERD §2.1) but ship with the phase that consumes them — no dead
 * controls (spec §1). This read re-checks the session itself (ADR-026), not just the layout.
 */
export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/sign-in");

  const joined = new Date(session.user.createdAt).toISOString().slice(0, 10);
  const timeZone = await getTimeZone(session.user.id);

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">Profile</h1>
      <div className="grid max-w-3xl gap-4">
        <Panel title="Account">
          <ProfileForm name={session.user.name} email={session.user.email} joined={joined} />
        </Panel>
        <Panel title="Regional">
          <p className="font-mono text-[10px] text-muted-foreground">
            your day — habits, the calendar, what counts as “due today” — follows this zone.
          </p>
          <TimeZoneForm current={timeZone} />
        </Panel>
      </div>
    </>
  );
}
