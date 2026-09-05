const {
  addSlaMinutes,
  elapsedSlaMinutes,
  percentConsumed
} = require("../../src/shared/utils/business-hours.util");
const {
  defaultServiceManagement,
  TICKET_PRIORITIES
} = require("../../src/shared/constants/service-management");
const { buildSlaCycle, refreshCycleStates } = require("../../src/modules/tickets/sla.service");

describe("business-hours SLA utilities", () => {
  test("calendar minutes when business hours disabled", () => {
    const start = new Date("2026-01-05T10:00:00.000Z");
    const due = addSlaMinutes(start, 120, {}, { useBusinessHours: false });
    expect(due.getTime() - start.getTime()).toBe(120 * 60 * 1000);
  });

  test("percentConsumed caps meaningfully", () => {
    expect(percentConsumed(50, 100)).toBe(50);
    expect(percentConsumed(150, 100)).toBe(150);
    expect(percentConsumed(10, 0)).toBe(0);
  });

  test("elapsed calendar minutes", () => {
    const from = new Date("2026-01-05T10:00:00.000Z");
    const to = new Date("2026-01-05T11:30:00.000Z");
    expect(elapsedSlaMinutes(from, to, {}, { useBusinessHours: false })).toBe(90);
  });
});

describe("SLA cycle builder", () => {
  test("uses tenant policy targets per priority", () => {
    const sm = defaultServiceManagement();
    const cycle = buildSlaCycle(sm, TICKET_PRIORITIES.CRITICAL, new Date("2026-01-05T00:00:00.000Z"), 1);
    expect(cycle.resolutionTargetMinutes).toBe(24 * 60);
    expect(cycle.cycleNumber).toBe(1);
    expect(cycle.resolutionDueAt).toBeTruthy();
  });

  test("refresh marks breached at 100%", () => {
    const sm = defaultServiceManagement();
    const started = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const cycle = buildSlaCycle(sm, TICKET_PRIORITIES.CRITICAL, started, 1);
    refreshCycleStates(cycle, sm, new Date());
    expect(cycle.resolutionPercent).toBeGreaterThanOrEqual(100);
    expect(cycle.resolutionState).toBe("BREACHED");
  });
});
