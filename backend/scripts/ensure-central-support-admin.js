#!/usr/bin/env node
/**
 * Idempotent Central Support Admin bootstrap.
 *
 * Usage (from backend/):
 *   CENTRAL_SUPPORT_ADMIN_EMAIL=... CENTRAL_SUPPORT_ADMIN_PASSWORD=... node scripts/ensure-central-support-admin.js
 */

require("dotenv").config();
const mongoose = require("mongoose");
const env = require("../src/config/env");
const authService = require("../src/modules/central-support/central-support-auth.service");

const main = async () => {
  const email = process.env.CENTRAL_SUPPORT_ADMIN_EMAIL || env.centralSupportAdmin?.email;
  const password =
    process.env.CENTRAL_SUPPORT_ADMIN_PASSWORD || env.centralSupportAdmin?.password;
  const name =
    process.env.CENTRAL_SUPPORT_ADMIN_NAME ||
    env.centralSupportAdmin?.name ||
    "Central Support Admin";

  if (!email || !password) {
    console.error(
      "Missing CENTRAL_SUPPORT_ADMIN_EMAIL and/or CENTRAL_SUPPORT_ADMIN_PASSWORD. Refusing to bootstrap."
    );
    process.exit(1);
  }

  await mongoose.connect(env.mongodbUri);

  try {
    const { user, created } = await authService.ensureBootstrapAdmin({ name, email, password });
    if (created) {
      console.log(`Central Support Admin created: ${user.email} (${user.role})`);
    } else {
      console.log(`Central Support Admin already exists: ${user.email} (no changes)`);
    }
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((err) => {
  console.error("ensure-central-support-admin failed:", err.message || err);
  process.exit(1);
});
