/**
 * Phase 12: tenant branding customization defaults.
 *
 * - Ensures settings.support exists on every tenant
 * - Sets customerLabel = CLIENT when missing (ELVA and others)
 * - Does NOT overwrite existing branding fields from Phase 9
 * - Idempotent / safe for re-run
 */

const { DEFAULT_CUSTOMER_LABEL } = require("../src/shared/constants/customer-labels");

module.exports = {
  async up(db) {
    const tenants = db.collection("tenants");

    const cursor = tenants.find({});
    while (await cursor.hasNext()) {
      const tenant = await cursor.next();
      const settings = tenant.settings && typeof tenant.settings === "object" ? tenant.settings : {};
      const support =
        settings.support && typeof settings.support === "object" ? { ...settings.support } : {};

      let changed = false;

      if (!settings.support || typeof settings.support !== "object") {
        changed = true;
      }

      if (!support.customerLabel) {
        support.customerLabel = DEFAULT_CUSTOMER_LABEL;
        changed = true;
      }

      if (!settings.branding || typeof settings.branding !== "object") {
        settings.branding = {};
        changed = true;
      }

      // Ensure support nested object is present; never wipe branding/organization
      if (changed) {
        await tenants.updateOne(
          { _id: tenant._id },
          {
            $set: {
              "settings.support": support,
              ...(settings.branding && !tenant.settings?.branding
                ? { "settings.branding": settings.branding }
                : {})
            }
          }
        );
      }
    }
  },

  async down() {
    // Non-destructive: leave support.customerLabel in place
  }
};
