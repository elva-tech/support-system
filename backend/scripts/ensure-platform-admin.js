#!/usr/bin/env node
/**
 * Idempotent Platform Super Admin bootstrap (Phase 5).
 *
 * Usage (from backend/):
 *   PLATFORM_ADMIN_EMAIL=... PLATFORM_ADMIN_PASSWORD=... PLATFORM_ADMIN_NAME=... node scripts/ensure-platform-admin.js
 *
 * Or set the same vars in .env (dotenv is loaded via env.js).
 *
 * - Does NOT run on API startup
 * - Does NOT convert tenant ADMIN users
 * - Does NOT log passwords
 * - Safe to re-run (skips when email already exists)
 */

require("dotenv").config();
const mongoose = require("mongoose");
const env = require("../src/config/env");
const platformAdminService = require("../src/modules/platform-admin/platform-admin.service");

const main = async () => {
  const email = process.env.PLATFORM_ADMIN_EMAIL;
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  const name = process.env.PLATFORM_ADMIN_NAME || "Platform Super Admin";

  if (!email || !password) {
    console.error(
      "Missing PLATFORM_ADMIN_EMAIL and/or PLATFORM_ADMIN_PASSWORD. Refusing to bootstrap."
    );
    process.exit(1);
  }

  await mongoose.connect(env.mongodbUri);

  try {
    const { admin, created } = await platformAdminService.ensureBootstrapSuperAdmin({
      name,
      email,
      password
    });

    if (created) {
      console.log(`Platform Super Admin created: ${admin.email} (${admin.role})`);
    } else {
      console.log(`Platform Super Admin already exists: ${admin.email} (no changes)`);
    }
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((err) => {
  console.error("ensure-platform-admin failed:", err.message || err);
  process.exit(1);
});
