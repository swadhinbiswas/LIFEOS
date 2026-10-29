"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { controlField } from "@/components/tui/controls";
import {
  createObligationAction,
  deleteObligationAction,
  payObligationAction,
  rejectObligationAction,
  restoreObligationAction,
  stopObligationAction,
  undoObligationPaymentAction,
} from "@/server/finance/actions";

const label = "flex flex-col gap-1 font-mono text-[10px] text-muted-foreground uppercase";

import type { Occurrence, PlanRow } from "@/server/finance/obligations";

export function ObligationsView({
  plans: initialPlans,
  accounts,
}: {
  plans: { plan: PlanRow; occurrences: Occurrence[] }[];
  accounts: { account: { id: string; name: string; currency: string } }[];
}) {
  const [plans] = useState(initialPlans.map((p) => ({ ...p.plan, occurrences: p.occurrences })));
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [direction, setDirection] = useState<"debt" | "credit">("debt");
  const [scheduleType, setScheduleType] = useState<"one_time" | "recurring" | "split">("one_time");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [cadence, setCadence] = useState("monthly");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [totalPayments, setTotalPayments] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = () => window.location.reload();

  const create = async () => {
    setBusy(true);
    setError("");
    const result = await createObligationAction({
      direction,
      name: name.trim(),
      scheduleType,
      amountMinor: Math.round(Number.parseFloat(amount) * 100),
      currency,
      cadence: scheduleType === "one_time" ? null : cadence,
      intervalCount: 1,
      totalPayments: totalPayments ? Number.parseInt(totalPayments, 10) : null,
      endDate: endDate || null,
      startDate,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.message ?? "failed");
      return;
    }
    setShowForm(false);
    setName("");
    setAmount("");
    refresh();
  };

  const pay = async (occId: string) => {
    if (accounts.length === 0) {
      setError("add an account first");
      return;
    }
    const accountId = accounts[0]!.account.id;
    const result = await payObligationAction({
      occurrenceId: occId,
      accountId,
      occurredAt: new Date(),
    });
    if (!result.ok) setError(result.message ?? "failed");
    else refresh();
  };

  return (
    <div className="flex flex-col gap-4 text-xs">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "cancel" : "new plan"}
        </Button>
      </div>

      {showForm ? (
        <div className="flex flex-col gap-2 border border-border p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className={label}>
              direction
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as "debt" | "credit")}
                className={controlField}
              >
                <option value="debt">I owe (debt)</option>
                <option value="credit">owed to me (credit)</option>
              </select>
            </label>
            <label className={`${label} min-w-40 flex-1`}>
              name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={controlField}
              />
            </label>
            <label className={label}>
              schedule
              <select
                value={scheduleType}
                onChange={(e) =>
                  setScheduleType(e.target.value as "one_time" | "recurring" | "split")
                }
                className={controlField}
              >
                <option value="one_time">one-time</option>
                <option value="recurring">recurring</option>
                <option value="split">split total</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className={label}>
              amount
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${controlField} w-24`}
              />
            </label>
            <label className={label}>
              currency
              <input
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={`${controlField} w-16`}
              />
            </label>
            {scheduleType !== "one_time" ? (
              <>
                <label className={label}>
                  cadence
                  <select
                    value={cadence}
                    onChange={(e) => setCadence(e.target.value)}
                    className={controlField}
                  >
                    <option value="daily">daily</option>
                    <option value="weekly">weekly</option>
                    <option value="monthly">monthly</option>
                    <option value="yearly">yearly</option>
                  </select>
                </label>
                <label className={label}>
                  total payments
                  <input
                    inputMode="numeric"
                    value={totalPayments}
                    onChange={(e) => setTotalPayments(e.target.value)}
                    className={`${controlField} w-20`}
                  />
                </label>
                <label className={label}>
                  end date
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={controlField}
                  />
                </label>
              </>
            ) : null}
            <label className={label}>
              start date
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={controlField}
              />
            </label>
          </div>
          <Button
            size="sm"
            disabled={busy || !name.trim() || !amount}
            onClick={() => void create()}
          >
            {busy ? "…" : "create"}
          </Button>
          {error ? (
            <span role="alert" className="text-destructive">
              {error}
            </span>
          ) : null}
        </div>
      ) : null}

      {plans.length === 0 ? (
        <p className="font-mono text-xs text-muted-foreground">no plans yet</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {plans.map((plan) => (
            <li key={plan.id} className="border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold">{plan.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {plan.direction} · {plan.scheduleType}
                </span>
              </div>
              <ul className="mt-2 flex flex-col gap-1">
                {plan.occurrences.slice(0, 12).map((occ) => (
                  <li
                    key={occ.id}
                    className="flex items-center justify-between gap-2 font-mono text-xs"
                  >
                    <span>{occ.dueDate}</span>
                    <span className={occ.amountMinor < 0 ? "text-destructive" : "text-success"}>
                      {(occ.amountMinor / 100).toFixed(2)} {plan.currency}
                    </span>
                    <span className="text-muted-foreground">{occ.status}</span>
                    {occ.status === "pending" ? (
                      <Button size="sm" variant="outline" onClick={() => void pay(occ.id)}>
                        pay
                      </Button>
                    ) : null}
                    {occ.status === "paid" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void undoObligationPaymentAction({ occurrenceId: occ.id }).then(() =>
                            window.location.reload(),
                          )
                        }
                      >
                        undo
                      </Button>
                    ) : null}
                    {occ.status === "pending" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void rejectObligationAction({ occurrenceId: occ.id }).then(() =>
                            window.location.reload(),
                          )
                        }
                      >
                        reject
                      </Button>
                    ) : null}
                    {occ.status === "rejected" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void restoreObligationAction({ occurrenceId: occ.id }).then(() =>
                            window.location.reload(),
                          )
                        }
                      >
                        restore
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void stopObligationAction({ planId: plan.id }).then(() =>
                      window.location.reload(),
                    )
                  }
                >
                  stop
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void deleteObligationAction({ planId: plan.id }).then(() =>
                      window.location.reload(),
                    )
                  }
                >
                  delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error ? (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
