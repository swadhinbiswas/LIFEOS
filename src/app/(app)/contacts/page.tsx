import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { PageHeader } from "@/components/tui/page-header";
import { listOwedContacts } from "@/server/contacts";
import { getServerSession } from "@/server/auth/session";

import { OwedContactsList } from "./_components/owed-contacts";

/**
 * `/contacts` — the people you owe replies to (ADR-132).
 *
 * A first-class route rather than a dashboard widget, because it is a queue you *work through* and
 * a widget is something you glance at. It is also the first page in the app that is about people
 * rather than about work on things, which is the gap the module had: `contacts` existed, but only
 * ever attached to a job application.
 */
export default async function ContactsPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Contacts");
  const owed = await listOwedContacts(session.user.id);

  return (
    <>
      <PageHeader title={t("title")} />
      <div className="grid min-w-0 gap-4">
        <Panel title={t("owedTitle")} hint={`${owed.length}`}>
          <OwedContactsList owed={owed} />
        </Panel>
      </div>
    </>
  );
}
