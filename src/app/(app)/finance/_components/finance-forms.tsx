"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  addTransactionAction,
  createAccountAction,
  createSubscriptionAction,
  setBudgetAction,
} from "@/server/finance/actions";

const field =
  "border border-border bg-background px-1.5 py-0.5 font-mono text-xs outline-none placeholder:text-muted-foreground";
const label = "flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase";

function useSubmit() {
  const router = useRouter();
  const t = useTranslations("Pages.Finance");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (
    call: () => Promise<{ ok: boolean; message?: string }>,
    reset?: () => void,
  ) => {
    setBusy(true);
    setError("");
    const result = await call();
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? t("couldNotSave"));
      return;
    }
    reset?.();
    router.refresh();
  };
  return { busy, error, submit };
}

/** Amounts are entered in currency units and stored as integer minor units (ADR-045). */
const toMinor = (value: string): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
};

export function AddAccountForm() {
  const t = useTranslations("Pages.Finance");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [opening, setOpening] = useState("");
  const { busy, error, submit } = useSubmit();

  return (
    <form
      method="post"
      data-slot="add-account"
      className="flex flex-wrap items-end gap-2 text-xs"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim() === "") return;
        void submit(
          () =>
            createAccountAction({
              name: name.trim(),
              currency: currency.trim().toUpperCase(),
              openingMinor: toMinor(opening === "" ? "0" : opening),
            }),
          () => {
            setName("");
            setOpening("");
          },
        );
      }}
    >
      <label className={label}>
        {t("account")}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("accountPlaceholder")}
          className={field}
          aria-label={t("accountName")}
        />
      </label>
      <label className={label}>
        {t("currency")}
        <input
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          maxLength={3}
          className={`${field} w-16`}
          aria-label={t("accountCurrency")}
        />
      </label>
      <label className={label}>
        {t("opening")}
        <input
          inputMode="decimal"
          value={opening}
          onChange={(e) => setOpening(e.target.value)}
          placeholder="0.00"
          className={`${field} w-24`}
          aria-label={t("opening")}
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={busy || name.trim() === ""}>
        {t("addAccount")}
      </Button>
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  );
}

export function AddTransactionForm({
  accounts,
}: {
  accounts: Array<{ id: string; name: string; currency: string }>;
}) {
  const t = useTranslations("Pages.Finance");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [direction, setDirection] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const { busy, error, submit } = useSubmit();

  if (accounts.length === 0) {
    return <p className="font-mono text-xs text-muted-foreground">{t("needAccount")}</p>;
  }

  // The account list arrives from a later render (the first render has none), so the selected id
  // falls back to the first account instead of staying at the stale initial value.
  const selectedAccountId = accounts.some((account) => account.id === accountId)
    ? accountId
    : (accounts[0]?.id ?? "");

  return (
    <form
      method="post"
      data-slot="add-transaction"
      className="flex flex-wrap items-end gap-2 text-xs"
      onSubmit={(event) => {
        event.preventDefault();
        if (amount.trim() === "" || selectedAccountId === "") return;
        const magnitude = Math.abs(toMinor(amount));
        void submit(
          () =>
            addTransactionAction({
              accountId: selectedAccountId,
              amountMinor: direction === "expense" ? -magnitude : magnitude,
              category: category.trim() === "" ? null : category.trim(),
            }),
          () => {
            setAmount("");
          },
        );
      }}
    >
      <label className={label}>
        {t("account")}
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className={field}
          aria-label={t("transactionAccount")}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.currency})
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        {t("type")}
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as "expense" | "income")}
          className={field}
          aria-label={t("transactionType")}
        >
          <option value="expense">{t("expense")}</option>
          <option value="income">{t("income")}</option>
        </select>
      </label>
      <label className={label}>
        {t("amount")}
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="12.50"
          className={`${field} w-24`}
          aria-label={t("transactionAmount")}
        />
      </label>
      <label className={label}>
        {t("category")}
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder={t("categoryPlaceholder")}
          className={field}
          aria-label={t("transactionCategory")}
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={busy || amount.trim() === ""}>
        {t("addTransaction")}
      </Button>
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  );
}

export function AddBudgetForm() {
  const t = useTranslations("Pages.Finance");
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const { busy, error, submit } = useSubmit();

  return (
    <form
      method="post"
      data-slot="add-budget"
      className="flex flex-wrap items-end gap-2 text-xs"
      onSubmit={(event) => {
        event.preventDefault();
        if (category.trim() === "" || limit.trim() === "") return;
        void submit(
          () =>
            setBudgetAction({
              category: category.trim(),
              limitMinor: Math.abs(toMinor(limit)),
              currency: currency.trim().toUpperCase(),
            }),
          () => {
            setCategory("");
            setLimit("");
          },
        );
      }}
    >
      <label className={label}>
        {t("category")}
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder={t("categoryPlaceholder")}
          className={field}
          aria-label={t("budgetCategory")}
        />
      </label>
      <label className={label}>
        {t("monthlyLimit")}
        <input
          inputMode="decimal"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          placeholder="300.00"
          className={`${field} w-24`}
          aria-label={t("budgetLimit")}
        />
      </label>
      <label className={label}>
        {t("currency")}
        <input
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          maxLength={3}
          className={`${field} w-16`}
          aria-label={t("budgetCurrency")}
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={busy || category.trim() === ""}>
        {t("setBudget")}
      </Button>
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  );
}

export function AddSubscriptionForm() {
  const t = useTranslations("Pages.Finance");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [cadence, setCadence] = useState<"month" | "year">("month");
  const [renews, setRenews] = useState("");
  const { busy, error, submit } = useSubmit();

  return (
    <form
      method="post"
      data-slot="add-subscription"
      className="flex flex-wrap items-end gap-2 text-xs"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim() === "" || amount.trim() === "") return;
        void submit(
          () =>
            createSubscriptionAction({
              name: name.trim(),
              amountMinor: Math.abs(toMinor(amount)),
              currency: currency.trim().toUpperCase(),
              cadence,
              renewsAt: renews === "" ? null : new Date(`${renews}T00:00:00.000Z`),
            }),
          () => {
            setName("");
            setAmount("");
            setRenews("");
          },
        );
      }}
    >
      <label className={label}>
        {t("subscription")}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("subscriptionPlaceholder")}
          className={field}
          aria-label={t("subscriptionName")}
        />
      </label>
      <label className={label}>
        {t("amount")}
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="9.99"
          className={`${field} w-24`}
          aria-label={t("subscriptionAmount")}
        />
      </label>
      <label className={label}>
        {t("currency")}
        <input
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          maxLength={3}
          className={`${field} w-16`}
          aria-label={t("subscriptionCurrency")}
        />
      </label>
      <label className={label}>
        {t("cadence")}
        <select
          value={cadence}
          onChange={(e) => setCadence(e.target.value as "month" | "year")}
          className={field}
          aria-label={t("subscriptionCadence")}
        >
          <option value="month">{t("monthly")}</option>
          <option value="year">{t("yearly")}</option>
        </select>
      </label>
      <label className={label}>
        {t("nextRenewal")}
        <input
          type="date"
          value={renews}
          onChange={(e) => setRenews(e.target.value)}
          className={field}
          aria-label={t("subscriptionRenewal")}
        />
      </label>
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={busy || name.trim() === "" || amount.trim() === ""}
      >
        {t("addSubscription")}
      </Button>
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  );
}
