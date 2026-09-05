/**
 * Domain / workspace availability unit tests (no DB for format/reserved paths).
 * Availability uniqueness path is covered when Mongo is available via integration suite.
 */

process.env.TENANT_BASE_DOMAIN = "support.example.test";
process.env.PLATFORM_ADMIN_HOST = "admin.support.example.test";
process.env.TENANT_WORKSPACE_PROTOCOL = "https";

// Re-require env after setting vars — jest may already have cached modules.
jest.resetModules();

describe("workspace domain service", () => {
  let workspaceDomain;

  beforeAll(() => {
    workspaceDomain = require("../../src/modules/tenants/workspace-domain.service");
  });

  test("builds workspace URL from environment base domain", () => {
    expect(workspaceDomain.buildWorkspaceHost("abc")).toBe("abc.support.example.test");
    expect(workspaceDomain.buildWorkspaceUrl("abc")).toBe("https://abc.support.example.test");
  });

  test("rejects reserved slug without claiming DNS record creation", async () => {
    const result = await workspaceDomain.checkWorkspaceAvailability("admin");
    expect(result.available).toBe(false);
    expect(result.code).toBe("RESERVED_TENANT_SLUG");
    expect(result.dnsMode).toBe("wildcard");
    expect(JSON.stringify(result)).not.toMatch(/DNS record created/i);
  });

  test("rejects invalid slug format", async () => {
    const result = await workspaceDomain.checkWorkspaceAvailability("Bad_Slug!");
    expect(result.available).toBe(false);
    expect(result.checks.some((c) => c.key === "slug_format" && !c.ok)).toBe(true);
  });

  test("invitation URL uses generated workspace host", () => {
    const url = workspaceDomain.buildInvitationUrl("acme", "tok123");
    expect(url.startsWith("https://acme.support.example.test")).toBe(true);
    expect(url).toContain("token=tok123");
  });
});
