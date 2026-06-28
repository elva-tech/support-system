const logger = require("../utils/logger");
const env = require("../../config/env");

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const levelClass = (level) => {
  switch (level) {
    case "error":
      return "log-error";
    case "warn":
      return "log-warn";
    case "debug":
      return "log-debug";
    default:
      return "log-info";
  }
};

const renderLogsPage = (req, res) => {
  const logs = logger.getEntries().slice().reverse();
  const rows = logs
    .map(
      (entry) =>
        `<tr class="${levelClass(entry.level)}"><td class="ts">${escapeHtml(entry.timestamp)}</td><td class="line"><pre>${escapeHtml(entry.line)}</pre></td></tr>`
    )
    .join("");

  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="3" />
  <title>ELVA Support API — Logs</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: #0f172a; color: #e2e8f0; }
    header { padding: 1rem 1.25rem; background: #13294b; border-bottom: 1px solid #1e293b; }
    h1 { margin: 0 0 0.25rem; font-size: 1.1rem; font-weight: 700; }
    p { margin: 0; color: #94a3b8; font-size: 0.85rem; }
    main { padding: 1rem; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; border-bottom: 1px solid #1e293b; padding: 0.5rem 0.75rem; }
    .ts { width: 12rem; color: #64748b; white-space: nowrap; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; font: inherit; }
    .log-error { background: rgba(239, 68, 68, 0.08); }
    .log-warn { background: rgba(245, 158, 11, 0.08); }
    .log-debug { background: rgba(56, 189, 248, 0.06); }
    .empty { padding: 2rem; text-align: center; color: #64748b; }
  </style>
</head>
<body>
  <header>
    <h1>ELVA Support API — Live Logs</h1>
    <p>${logs.length} entries · auto-refresh every 3s · ${escapeHtml(env.nodeEnv)}</p>
  </header>
  <main>
    ${
      logs.length
        ? `<table><tbody>${rows}</tbody></table>`
        : '<div class="empty">No log entries yet.</div>'
    }
  </main>
</body>
</html>`);
};

const logsViewerMiddleware = (req, res, next) => {
  if (!env.logViewerEnabled) {
    return res.status(404).json({ message: "Route not found" });
  }

  return renderLogsPage(req, res);
};

module.exports = { logsViewerMiddleware };
