const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const env = require("./config/env");
const errorHandler = require("./shared/middleware/error.middleware");
const { requestIdMiddleware } = require("./shared/middleware/request-id.middleware");
const { accessLogMiddleware } = require("./shared/middleware/access-log.middleware");
const { getHealth, getLiveness, getReadiness } = require("./shared/health/health.service");
const { isAllowedCorsOrigin } = require("./shared/utils/cors-origin.util");
const { toPrometheusText } = require("./shared/observability/metrics");

const authRoutes = require("./modules/auth/auth.routes");
const applicationRoutes = require("./modules/applications/application.routes");
const moduleRoutes = require("./modules/modules/module.routes");
const teamRoutes = require("./modules/teams/team.routes");
const userRoutes = require("./modules/users/user.routes");
const merchantRoutes = require("./modules/merchants/merchant.routes");
const merchantAdminRoutes = require("./modules/merchants/merchant-admin.routes");
const internalRoutes = require("./modules/merchants/internal.routes");
const ticketRoutes = require("./modules/tickets/ticket.routes");
const dashboardRoutes = require("./modules/dashboard/dashboard.routes");
const attachmentRoutes = require("./modules/attachments/attachment.routes");
const classificationRoutes = require("./modules/classification/classification.routes");
const omnichannelRoutes = require("./modules/omnichannel/omnichannel.routes");
const notificationCenterRoutes = require("./modules/notifications/notification-center.routes");
const inboundMailQueueRoutes = require("./modules/inbound-mail-queue/inbound-mail-queue.routes");
const inboundEmailWebhookRoutes = require("./modules/email/email-inbound-webhook.routes");
const platformAdminRoutes = require("./modules/platform-admin/platform-admin.routes");
const tenantProvisioningRoutes = require("./modules/tenant-provisioning/tenant-provisioning.routes");
const onboardingRoutes = require("./modules/tenant-provisioning/onboarding.routes");
const workspaceRoutes = require("./modules/workspace/workspace.routes");

const {
  logsViewerMiddleware,
  logsViewerLogin,
  logsViewerLogout
} = require("./shared/http/logs-viewer");

const app = express();

// Phase 13: explicit trust proxy (default false). Set TRUST_PROXY=1 behind reverse proxies.
app.set("trust proxy", env.trustProxy);

const corsOptions = {
  exactOrigins: env.corsOrigins,
  baseDomain: env.tenant.baseDomain,
  allowTenantSubdomains: env.corsAllowTenantSubdomains,
  allowLocalhost: env.corsAllowLocalhost,
  allowVercelPreviews: env.corsAllowVercelPreviews,
  requireHttpsForSubdomains: env.isProduction ? env.corsRequireHttpsSubdomains : false
};

const evaluateCorsOrigin = (origin) => isAllowedCorsOrigin(origin, corsOptions);

app.use(
  helmet({
    // Angular SPA + API on separate hosts: do not force overly strict COOP/COEP defaults
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
    referrerPolicy: { policy: "no-referrer" }
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, evaluateCorsOrigin(origin));
    },
    credentials: true
  })
);
// Phase 14: correlation + access logs (before routes). Morgan optional to avoid duplicates.
app.use(requestIdMiddleware);
app.use(accessLogMiddleware);
if (env.logging?.morgan || process.env.LOG_MORGAN === "true") {
  app.use(morgan(env.isProduction ? "combined" : "dev"));
}
app.use(
  "/api/webhooks/inbound-email",
  express.json({ limit: "15mb" }),
  inboundEmailWebhookRoutes
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

app.get("/", logsViewerMiddleware);
app.post("/logs/login", logsViewerLogin);
app.post("/logs/logout", logsViewerLogout);

/** Liveness — process up (no DB). */
app.get("/health", (_req, res) => {
  res.status(200).json(getLiveness());
});

/** Readiness — MongoDB connectivity. */
app.get("/health/ready", async (_req, res) => {
  const ready = await getReadiness();
  const statusCode = ready.status === "ready" ? 200 : 503;
  res.status(statusCode).json(ready);
});

/** Legacy detailed health (ops). Prefer /health and /health/ready for probes. */
app.get("/health/detail", async (_req, res) => {
  const health = await getHealth();
  const statusCode = health.status === "ok" ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * Optional low-cardinality metrics (Phase 14).
 * Enable with METRICS_ENDPOINT_ENABLED=true and protect via reverse proxy or INTERNAL_API_KEY.
 */
app.get("/metrics", (req, res) => {
  if (!env.metricsEndpointEnabled) {
    return res.status(404).json({ message: "Route not found" });
  }
  const key = req.headers["x-internal-api-key"];
  if (!key || key !== env.internalApiKey) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  res.setHeader("Content-Type", "text/plain; version=0.0.4");
  res.status(200).send(toPrometheusText());
});

app.use("/api/auth", authRoutes);
/** Platform Administration APIs — no tenant context; separate JWT identity. */
app.use("/api/platform", tenantProvisioningRoutes);
app.use("/api/platform", platformAdminRoutes);
/** Public tenant admin onboarding (invitation token based). */
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/workspace", workspaceRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/modules", moduleRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/users", userRoutes);
app.use("/api/merchant", merchantRoutes);
app.use("/api/merchants", merchantAdminRoutes);
app.use("/api/internal", internalRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/attachments", attachmentRoutes);
app.use("/api/classification", classificationRoutes);
app.use("/api/omnichannel", omnichannelRoutes);
app.use("/api/notification-center", notificationCenterRoutes);
app.use("/api/inbound-mail-queue", inboundMailQueueRoutes);
app.use("/api/audit", require("./modules/audit/audit.routes"));
app.use("/api/platform/integrity", require("./modules/tenant-integrity/integrity.routes"));

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use(errorHandler);

module.exports = app;
module.exports.evaluateCorsOrigin = evaluateCorsOrigin;
