const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const env = require("./config/env");
const errorHandler = require("./shared/middleware/error.middleware");
const { getHealth } = require("./shared/health/health.service");

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

const { logsViewerMiddleware } = require("./shared/http/logs-viewer");

const app = express();

const isAllowedCorsOrigin = (origin) => {
  if (!origin) {
    return true;
  }

  if (env.corsOrigins.includes(origin)) {
    return true;
  }

  if (env.corsAllowVercelPreviews && /^https:\/\/[\w-]+\.vercel\.app$/.test(origin)) {
    return true;
  }

  return false;
};

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, isAllowedCorsOrigin(origin));
    },
    credentials: true
  })
);
app.use(morgan(env.isProduction ? "combined" : "dev"));
app.use(express.json({ limit: "1mb" }));

app.get("/", logsViewerMiddleware);

app.get("/health", async (_req, res) => {
  const health = await getHealth();
  const statusCode = health.status === "ok" ? 200 : 503;
  res.status(statusCode).json(health);
});

app.use("/api/auth", authRoutes);
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

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use(errorHandler);

module.exports = app;
