"use client";

import { useRouter } from "next/navigation";
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
      setError(result.message ?? "could not save");
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
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [opening, setOpening] = useState("");
  const { busy, error, submit } = useSubmit();

  return (
    <form
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
        account
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="current account"
          className={field}
          aria-label="account name"
        />
      </label>
      <label className={label}>
        currency
        <input
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          maxLength={3}
          className={`${field} w-16`}
          aria-label="account currency"
        />
      </label>
      <label className={label}>
        opening balance
        <input
          inputMode="decimal"
          value={opening}
          onChange={(e) => setOpening(e.target.value)}
          placeholder="0.00"
          className={`${field} w-24`}
          aria-label="opening balance"
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={busy || name.trim() === ""}>
        add account
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
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [direction, setDirection] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const { busy, error, submit } = useSubmit();

  if (accounts.length === 0) {
    return (
      <p className="font-mono text-xs text-muted-foreground">
        add an account first — transactions belong to one
      </p>
    );
  }

  // The account list arrives from a later render (the first render has none), so the selected id
  // falls back to the first account instead of staying at the stale initial value.
  const selectedAccountId = accounts.some((account) => account.id === accountId)
    ? accountId
    : (accounts[0]?.id ?? "");

  return (
    <form
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
        account
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className={field}
          aria-label="transaction account"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.currency})
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        type
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as "expense" | "income")}
          className={field}
          aria-label="transaction type"
        >
          <option value="expense">expense</option>
          <option value="income">income</option>
        </select>
      </label>
      <label className={label}>
        amount
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="12.50"
          className={`${field} w-24`}
          aria-label="transaction amount"
        />
      </label>
      <label className={label}>
        category
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="groceries"
          className={field}
          aria-label="transaction category"
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={busy || amount.trim() === ""}>
        add transaction
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
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const { busy, error, submit } = useSubmit();

  return (
    <form
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
        category
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="groceries"
          className={field}
          aria-label="budget category"
        />
      </label>
      <label className={label}>
        monthly limit
        <input
          inputMode="decimal"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          placeholder="300.00"
          className={`${field} w-24`}
          aria-label="budget limit"
        />
      </label>
      <label className={label}>
        currency
        <input
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          maxLength={3}
          className={`${field} w-16`}
          aria-label="budget currency"
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={busy || category.trim() === ""}>
        set budget
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
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [cadence, setCadence] = useState<"month" | "year">("month");
  const [renews, setRenews] = useState("");
  const { busy, error, submit } = useSubmit();

  return (
    <form
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
        subscription
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="cloud storage"
          className={field}
          aria-label="subscription name"
        />
      </label>
      <label className={label}>
        amount
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="9.99"
          className={`${field} w-24`}
          aria-label="subscription amount"
        />
      </label>
      <label className={label}>
        currency
        <input
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          maxLength={3}
          className={`${field} w-16`}
          aria-label="subscription currency"
        />
      </label>
      <label className={label}>
        cadence
        <select
          value={cadence}
          onChange={(e) => setCadence(e.target.value as "month" | "year")}
          className={field}
          aria-label="subscription cadence"
        >
          <option value="month">monthly</option>
          <option value="year">yearly</option>
        </select>
      </label>
      <label className={label}>
        next renewal
        <input
          type="date"
          value={renews}
          onChange={(e) => setRenews(e.target.value)}
          className={field}
          aria-label="subscription renewal date"
        />
      </label>
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={busy || name.trim() === "" || amount.trim() === ""}
      >
        add subscription
      </Button>
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </form>
  );
}
