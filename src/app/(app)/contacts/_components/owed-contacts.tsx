import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/tui/empty-state";
import { ContactFollowUp } from "./contact-follow-up";
import type { OwedContact } from "@/server/contacts";

/**
 * Who you said you would get back to (ADR-132).
 *
 * The list is deliberately short and deliberately only promises. "You have not spoken to X in 19
 * days" is true of nearly everyone you know and is therefore not information; "you told X you would
 * send the portfolio by Friday" is a debt you created and can discharge.
 */
export async function OwedContactsList({ owed }: { owed: OwedContact[] }) {
  const t = await getTranslations("Pages.Contacts");

  if (owed.length === 0) {
    return (
      <EmptyState title={t("owedEmptyTitle")} hint={t("owedEmptyHint")}>
        <a
          href="/contacts"
          className="rounded-[var(--radius)] border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
        >
          {t("owedOpenContacts")}
        </a>
      </EmptyState>
    );
  }

  return (
    <ul className="grid gap-1" data-slot="owed-contacts">
      {owed.map((contact) => (
        <li
          key={contact.id}
          data-slot="owed-row"
          className="flex flex-wrap items-center gap-2 border-b border-border/50 py-1.5 last:border-0"
        >
          <span className="min-w-32 font-mono text-xs">{contact.name}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">
            {contact.company
              ? `${contact.title ? `${contact.title}, ` : ""}${contact.company}`
              : contact.title}
          </span>
          {/* Today is not late. "0 days overdue" on something you promised for this morning is a
              lie you would read as a scolding. */}
          <span
            data-slot="owed-overdue"
            className={
              contact.daysOverdue > 0
                ? "font-mono text-[10px] tabular-nums text-warning"
                : "font-mono text-[10px] tabular-nums text-muted-foreground"
            }
          >
            {contact.daysOverdue > 0
              ? t("owedDaysOverdue", { count: contact.daysOverdue })
              : t("owedDueToday")}
          </span>
          <ContactFollowUp contactId={contact.id} name={contact.name} />
        </li>
      ))}
    </ul>
  );
}
