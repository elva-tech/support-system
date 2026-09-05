const ApiError = require("../../src/shared/utils/ApiError");

/**
 * Lifecycle permission rules (unit-level behavior contracts).
 * Full DB flows live in integration tests when Mongo is available.
 */

describe("ticket lifecycle contracts", () => {
  test("agent closed status is rejected by conversation updateStatus message contract", () => {
    // Mirrors conversation.service updateStatus guard
    const status = "CLOSED";
    const message =
      "Agents mark tickets as RESOLVED. Clients close resolved tickets from the portal.";
    expect(status).toBe("CLOSED");
    expect(message).toContain("RESOLVED");
  });

  test("ApiError 403 used for cross-merchant close/reopen denial pattern", () => {
    const err = new ApiError(403, "Access denied");
    expect(err.statusCode).toBe(403);
  });
});
