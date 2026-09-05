/**
 * migrate-mongo configuration for ELVA Support.
 * Uses the same MONGODB_URI convention as the application (backend/.env).
 * Migrations are intentional — they are NOT run on application startup.
 */
require("dotenv").config();

const config = {
  mongodb: {
    url: process.env.MONGODB_URI || "mongodb://localhost:27017/elva-support-dev",
    options: {}
  },
  migrationsDir: "migrations",
  changelogCollectionName: "changelog",
  lockCollectionName: "changelog_lock",
  lockTtl: 0,
  migrationFileExtension: ".js",
  useFileHash: false,
  moduleSystem: "commonjs"
};

module.exports = config;
