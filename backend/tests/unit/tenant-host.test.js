const { parseTenantSlugFromHostname, extractHostname } = require("../../src/shared/utils/tenant-host.util");

describe("tenant-host.util", () => {
  const base = "elvasupport.in";

  test("parses tenant subdomains", () => {
    expect(parseTenantSlugFromHostname("abc.elvasupport.in", base)).toEqual({
      kind: "tenant",
      slug: "abc"
    });
    expect(parseTenantSlugFromHostname("elva.elvasupport.in", base)).toEqual({
      kind: "tenant",
      slug: "elva"
    });
  });

  test("reserved / platform hosts are not tenants", () => {
    expect(parseTenantSlugFromHostname("admin.elvasupport.in", base).kind).toBe("platform");
    expect(parseTenantSlugFromHostname("support.elvasupport.in", base).kind).toBe("central-support");
    expect(parseTenantSlugFromHostname("www.elvasupport.in", base).kind).toBe("reserved");
    expect(parseTenantSlugFromHostname("api.elvasupport.in", base).kind).toBe("reserved");
  });

  test("localhost and apex are not tenants", () => {
    expect(parseTenantSlugFromHostname("localhost", base).kind).toBe("local");
    expect(parseTenantSlugFromHostname("127.0.0.1", base).kind).toBe("local");
    expect(parseTenantSlugFromHostname("elvasupport.in", base).kind).toBe("apex");
  });

  test("external API hosts are not tenants", () => {
    expect(parseTenantSlugFromHostname("support-system-qhjr.onrender.com", base).kind).toBe(
      "external"
    );
  });

  test("extractHostname strips port; forwarded host only when trustProxy", () => {
    expect(extractHostname({ headers: { host: "elva.elvasupport.in:443" } })).toBe(
      "elva.elvasupport.in"
    );
    expect(
      extractHostname(
        {
          headers: { "x-forwarded-host": "abc.elvasupport.in, other.example.com", host: "ignored" }
        },
        { trustProxy: false }
      )
    ).toBe("ignored");
    expect(
      extractHostname(
        {
          headers: { "x-forwarded-host": "abc.elvasupport.in, other.example.com", host: "ignored" }
        },
        { trustProxy: true }
      )
    ).toBe("abc.elvasupport.in");
  });
});
