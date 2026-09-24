"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { NotificationView } from "@/server/notifications";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/server/notifications/actions";

/**
 * The centre's list (spec §6.9). Marking is a write, then a refresh so the server-rendered
 * unread count in the header bell matches; unread rows carry the word "unread" as well as a
 * brighter kind chip, so the state is never colour alone.
 */
export function NotificationsList({
  items,
  unread,
}: {
  items: NotificationView[];
  unread: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const readOne = async (id: string) => {
    await markNotificationReadAction({ id });
    router.refresh();
  };

  const readAll = async () => {
    setBusy(true);
    await markAllNotificationsReadAction();
    setBusy(false);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">{unread} unread</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="ml-auto"
          disabled={busy || unread === 0}
          onClick={() => void readAll()}
          data-slot="mark-all-read"
        >
          mark all read
        </Button>
      </div>

      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li
            key={item.id}
            data-slot="notification-row"
            data-read={item.readAt ? "true" : "false"}
            className="flex flex-wrap items-center gap-2 border border-border px-2 py-1 font-mono text-xs"
          >
            <span
              data-slot="notification-kind"
              className={item.readAt ? "text-muted-foreground" : "text-primary"}
            >
              {item.kind}
            </span>

            {item.href ? (
              <Link
                href={item.href}
                className="min-w-0 flex-1 truncate hover:underline"
                onClick={() => void readOne(item.id)}
              >
                {item.title}
              </Link>
            ) : (
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
            )}

            {item.body ? <span className="truncate text-muted-foreground">{item.body}</span> : null}

            {item.readAt ? (
              <span className="text-muted-foreground">read</span>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`mark ${item.title} read`}
                onClick={() => void readOne(item.id)}
                data-slot="mark-read"
              >
                mark read
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
