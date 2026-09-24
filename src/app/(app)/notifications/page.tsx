import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Panel } from "@/components/tui/panel";
import { getServerSession } from "@/server/auth/session";
import { listNotifications } from "@/server/notifications";
import { getTimeZone } from "@/server/settings";

import { NotificationsList } from "./_components/notifications-list";

export const metadata = { title: "Notifications" };

/**
 * `/notifications` (spec §6.9): the in-app centre. The service sweeps the sources on read
 * (ADR-047), so opening this page is what materialises any nudge that has just become true —
 * there is no worker behind it.
 */
export default async function NotificationsPage() {
  const session = await getServerSession();
  if (!session) redirect("/sign-in");

  const t = await getTranslations("Pages.Notifications");
  const timeZone = await getTimeZone(session.user.id);
  const { items, unread } = await listNotifications(session.user.id, new Date(), timeZone);

  return (
    <>
      <h1 className="mb-4 font-mono text-sm font-semibold tracking-wider uppercase">
        {t("title")}
      </h1>

      <div className="grid max-w-3xl gap-4">
        <Panel title={t("inbox")} hint={t("unreadCount", { count: unread })}>
          {items.length === 0 ? (
            <p data-slot="notifications-empty" className="font-mono text-xs text-muted-foreground">
              {t("empty")}
            </p>
          ) : (
            <NotificationsList items={items} unread={unread} />
          )}
        </Panel>
      </div>
    </>
  );
}
