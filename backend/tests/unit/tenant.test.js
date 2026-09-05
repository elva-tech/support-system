/**
 * Unit tests: tenant slug/name/status validation (no DB required for pure validators).
 * Service + seed idempotency use the shared Jest Mongo setup.
 */
const {
  normalizeTenantSlug,
  isReservedTenantSlug,
  validateTenantSlug,
  assertValidTenantSlug,
  assertValidTenantName,
  assertValidTenantStatus
} = require("../../src/modules/tenants/tenant.validation");
const tenantService = require("../../src/modules/tenants/tenant.service");
const Tenant = require("../../src/modules/tenants/tenant.model");
const {
  TENANT_STATUSES,
  RESERVED_TENANT_SLUGS,
  ELVA_TENANT_SEED,
  TENANT_ERROR_CODES
} = require("../../src/shared/constants/tenant");

describe("tenant.validation", () => {
  test("normalizes slug to lowercase and trims", () => {
    expect(normalizeTenantSlug("  ELVA  ")).toBe("elva");
    expect(normalizeTenantSlug("ABC-Software")).toBe("abc-software");
  });

  test("accepts valid slugs", () => {
    for (const slug of ["elva", "abc", "abc-software", "company123"]) {
      const result = validateTenantSlug(slug);
      expect(result.valid).toBe(true);
      expect(result.slug).toBe(slug.toLowerCase());
    }
  });

  test("rejects invalid slug formats", () => {
    for (const slug of ["ABC Company", "abc_company", "abc.company", "-elva", "elva-", "elva--tech"]) {
      const result = validateTenantSlug(slug);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("INVALID_TENANT_SLUG");
    }
  });

  test("rejects reserved slugs (case-insensitive)", () => {
    for (const slug of ["admin", "WWW", "Api", "support", "mail", "portal"]) {
      expect(isReservedTenantSlug(slug)).toBe(true);
      const result = validateTenantSlug(slug);
      expect(result.valid).toBe(false);
      expect(result.code).toBe("RESERVED_TENANT_SLUG");
    }
    expect(RESERVED_TENANT_SLUGS).toEqual(
      expect.arrayContaining(["admin", "www", "api", "mail", "support", "app", "portal", "static", "assets"])
    );
  });

  test("assertValidTenantSlug throws ApiError for reserved and invalid", () => {
    expect(() => assertValidTenantSlug("admin")).toThrow(/reserved/i);
    expect(() => assertValidTenantSlug("bad_slug")).toThrow(/slug/i);
    expect(assertValidTenantSlug("ELVA")).toBe("elva");
  });

  test("assertValidTenantName requires non-empty trimmed name", () => {
    expect(() => assertValidTenantName("  ")).toThrow(/name/i);
    expect(assertValidTenantName("  ELVA Technologies  ")).toBe("ELVA Technologies");
  });

  test("assertValidTenantStatus rejects unknown statuses", () => {
    expect(() => assertValidTenantStatus("ACTIVE")).not.toThrow();
    expect(() => assertValidTenantStatus("TRIAL")).not.toThrow();
    expect(() => assertValidTenantStatus("BOGUS")).toThrow(/status/i);
  });
});

describe("tenant.service", () => {
  test("creates a valid tenant", async () => {
    const tenant = await tenantService.create({
      name: "ABC Software",
      slug: "ABC"
    });
    expect(tenant.slug).toBe("abc");
    expect(tenant.name).toBe("ABC Software");
    expect(tenant.status).toBe(TENANT_STATUSES.ACTIVE);
    expect(tenant.settings).toMatchObject({
      organization: {},
      branding: {},
      notifications: {}
    });
  });

  test("cannot create two tenants with the same slug", async () => {
    await tenantService.create({ name: "One", slug: "dup-co" });
    await expect(tenantService.create({ name: "Two", slug: "DUP-CO" })).rejects.toMatchObject({
      statusCode: 409,
      errors: { code: TENANT_ERROR_CODES.TENANT_SLUG_ALREADY_EXISTS }
    });
  });

  test("rejects reserved slugs on create", async () => {
    await expect(tenantService.create({ name: "Admin Org", slug: "admin" })).rejects.toMatchObject({
      statusCode: 400,
      errors: { code: TENANT_ERROR_CODES.RESERVED_TENANT_SLUG }
    });
  });

  test("rejects invalid status on create", async () => {
    await expect(
      tenantService.create({ name: "X", slug: "x-co", status: "NOPE" })
    ).rejects.toMatchObject({
      statusCode: 400,
      errors: { code: TENANT_ERROR_CODES.INVALID_TENANT_STATUS }
    });
  });

  test("getBySlug and updateStatus", async () => {
    const created = await tenantService.create({ name: "Zed", slug: "zed" });
    const found = await tenantService.getBySlug("ZED");
    expect(found._id.toString()).toBe(created._id.toString());

    const updated = await tenantService.updateStatus(created._id, TENANT_STATUSES.SUSPENDED);
    expect(updated.status).toBe(TENANT_STATUSES.SUSPENDED);
  });

  test("ensureElvaTenant is idempotent", async () => {
    const first = await tenantService.ensureElvaTenant();
    expect(first.created).toBe(true);
    expect(first.tenant.slug).toBe(ELVA_TENANT_SEED.slug);
    expect(first.tenant.name).toBe(ELVA_TENANT_SEED.name);

    const second = await tenantService.ensureElvaTenant();
    expect(second.created).toBe(false);
    expect(second.tenant._id.toString()).toBe(first.tenant._id.toString());

    const count = await Tenant.countDocuments({ slug: ELVA_TENANT_SEED.slug });
    expect(count).toBe(1);
  });
});
