const WORKSPACE_SETUP_STATUSES = Object.freeze({
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED"
});

const ALL_WORKSPACE_SETUP_STATUSES = Object.values(WORKSPACE_SETUP_STATUSES);

/** Required for COMPLETED status (branding/users/client remain recommended). */
const REQUIRED_SETUP_STEPS = Object.freeze(["organization", "team", "application"]);

const ALL_SETUP_STEPS = Object.freeze([
  "organization",
  "branding",
  "team",
  "application",
  "users",
  "client"
]);

const defaultSetupSteps = () => ({
  organization: false,
  branding: false,
  team: false,
  application: false,
  users: false,
  client: false
});

const defaultWorkspaceSetup = () => ({
  status: WORKSPACE_SETUP_STATUSES.NOT_STARTED,
  steps: defaultSetupSteps(),
  completedAt: null,
  skipped: {
    branding: false,
    users: false,
    client: false
  }
});

/** Hex color #RGB or #RRGGBB */
const PRIMARY_COLOR_PATTERN = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

const LOGO_ALLOWED_MIME_TYPES = Object.freeze([
  "image/png",
  "image/jpeg",
  "image/webp"
]);

const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

module.exports = {
  WORKSPACE_SETUP_STATUSES,
  ALL_WORKSPACE_SETUP_STATUSES,
  REQUIRED_SETUP_STEPS,
  ALL_SETUP_STEPS,
  defaultSetupSteps,
  defaultWorkspaceSetup,
  PRIMARY_COLOR_PATTERN,
  LOGO_ALLOWED_MIME_TYPES,
  LOGO_MAX_BYTES
};
