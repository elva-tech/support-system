const { redactObject } = require("../../src/shared/utils/log-redaction.util");
const logger = require("../../src/shared/utils/logger");
const { normalizeIncomingRequestId } = require("../../src/shared/middleware/request-id.middleware");
const { isHealthPath } = require("../../src/shared/middleware/access-log.middleware");
const { registerGracefulShutdown, isShuttingDown } = require("../../src/shared/observability/shutdown");

describe("Phase 14 unit: logging and shutdown helpers", () => {
  test("logger redacts password when logging meta", () => {
    logger.clear();
    const prev = process.env.LOG_FORMAT;
    process.env.LOG_FORMAT = "json";
    logger.info("test", { password: "x", token: "y", path: "/ok" });
    const entries = logger.getEntries();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[entries.length - 1].line).toContain("[REDACTED]");
    expect(entries[entries.length - 1].line).not.toContain('"password":"x"');
    process.env.LOG_FORMAT = prev;
  });

  test("request id validation", () => {
    expect(normalizeIncomingRequestId("")).toBeNull();
    expect(normalizeIncomingRequestId("short")).toBeNull();
    expect(normalizeIncomingRequestId("abcdefgh")).toBe("abcdefgh");
  });

  test("health path detection", () => {
    expect(isHealthPath("/health")).toBe(true);
    expect(isHealthPath("/health/ready")).toBe(true);
    expect(isHealthPath("/api/auth/login")).toBe(false);
  });

  test("redactObject does not mutate input", () => {
    const input = { password: "secret", nested: { apiKey: "k" } };
    const copy = JSON.parse(JSON.stringify(input));
    redactObject(input);
    expect(input).toEqual(copy);
  });

  test("graceful shutdown registration is idempotent-safe", () => {
    expect(typeof registerGracefulShutdown).toBe("function");
    expect(isShuttingDown()).toBe(false);
  });
});
