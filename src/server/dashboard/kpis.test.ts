import { describe, expect, it } from "vitest";

import { computeKpis, KPI_DEFINITIONS, type KpiFixtureInput } from "./kpis";

const fixture: KpiFixtureInput = {
  completedThisWeek: 7,
  completedLastWeek: 5,
  focusMinutesThisWeek: 300,
  focusMinutesLastWeek: 250,
  habitLogsThisWeek: 18,
  habitLogsLastWeek: 14,
  habitCount: 3,
  activeGoals: 4,
  activeGoalsLastWeek: 4,
  openApplications: 9,
  openApplicationsLastWeek: 12,
  budgetRemainingMinor: 42_000,
  budgetRemainingLastMonthMinor: 50_000,
  currency: "EUR",
};

describe("dashboard KPIs (spec 6.8)", () => {
  it("computes each KPI from the fixture, hand-checked", () => {
    const byId = new Map(computeKpis(fixture).map((kpi) => [kpi.id, kpi]));

    expect(byId.get("tasksDoneThisWeek")).toMatchObject({ value: 7, delta: 2 });
    expect(byId.get("focusMinutesThisWeek")).toMatchObject({ value: 300, delta: 50, unit: "min" });
    // 18 of 21 possible check-ins = 86%; last week 14 of 21 = 67%; delta 19.
    expect(byId.get("habitConsistency")).toMatchObject({ value: 86, delta: 19, unit: "%" });
    expect(byId.get("activeGoals")).toMatchObject({ value: 4, delta: 0 });
    expect(byId.get("openApplications")).toMatchObject({ value: 9, delta: -3 });
    // A snapshot with no history reports no comparison rather than a fake zero.
    const snapshot = computeKpis({ ...fixture, openApplicationsLastWeek: null }).find(
      (kpi) => kpi.id === "openApplications",
    );
    expect(snapshot?.delta).toBeNull();
    expect(byId.get("budgetRemaining")).toMatchObject({
      value: 42_000,
      delta: -8_000,
      unit: "EUR",
    });
  });

  it("never divides by zero when there are no habits", () => {
    const empty = computeKpis({
      ...fixture,
      habitCount: 0,
      habitLogsThisWeek: 0,
      habitLogsLastWeek: 0,
    });
    const consistency = empty.find((kpi) => kpi.id === "habitConsistency");
    expect(consistency?.value).toBe(0);
    expect(consistency?.delta).toBe(0);
  });

  it("gives every KPI a label, a definition and a list to open", () => {
    for (const kpi of computeKpis(fixture)) {
      const definition = KPI_DEFINITIONS[kpi.id];
      expect(definition, `missing definition for ${kpi.id}`).toBeDefined();
      expect(definition?.definition.length ?? 0).toBeGreaterThan(10);
      expect(definition?.href.startsWith("/")).toBe(true);
    }
    expect(Object.keys(KPI_DEFINITIONS)).toHaveLength(6);
  });
});
