const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");
const env = require("../../config/env");
const User = require("../../modules/users/user.model");
const { ROLES } = require("../../shared/constants/roles");

const LOGS_COOKIE = "elva_logs_token";
const LOGS_SESSION_HOURS = 12;

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const parseCookies = (header) => {
  const cookies = {};
  if (!header) {
    return cookies;
  }

  for (const part of header.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) {
      continue;
    }
    cookies[rawKey] = decodeURIComponent(rest.join("=") || "");
  }

  return cookies;
};

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

const signLogsToken = (userId) =>
  jwt.sign({ sub: userId, purpose: "logs-viewer" }, env.jwtSecret, {
    expiresIn: `${LOGS_SESSION_HOURS}h`
  });

const verifyLogsToken = (token) => {
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    if (payload.purpose !== "logs-viewer") {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

const setLogsCookie = (res, token) => {
  const secure = env.isProduction ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${LOGS_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${LOGS_SESSION_HOURS * 3600}${secure}`
  );
};

const clearLogsCookie = (res) => {
  const secure = env.isProduction ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${LOGS_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
  );
};

const getSessionFromRequest = (req) => {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[LOGS_COOKIE];
  if (!token) {
    return null;
  }
  return verifyLogsToken(token);
};

const renderLoginPage = (res, { error = null } = {}) => {
  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ELVA Support API — Logs</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; }
    .card { width: min(100%, 22rem); padding: 1.5rem; background: #13294b; border: 1px solid #1e293b; border-radius: 12px; }
    h1 { margin: 0 0 0.5rem; font-size: 1.15rem; }
    p { margin: 0 0 1rem; color: #94a3b8; font-size: 0.9rem; }
    label { display: block; margin-bottom: 0.35rem; font-size: 0.85rem; color: #cbd5e1; }
    input { width: 100%; margin-bottom: 0.85rem; padding: 0.6rem 0.75rem; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: #e2e8f0; }
    button { width: 100%; padding: 0.65rem; border: 0; border-radius: 8px; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; }
    .error { margin-bottom: 1rem; padding: 0.6rem 0.75rem; border-radius: 8px; background: rgba(239,68,68,0.15); color: #fecaca; font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>ELVA Support API</h1>
    <p>Sign in with an admin account to view server logs.</p>
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
    <form method="post" action="/logs/login">
      <label for="email">Email</label>
      <input id="email" name="email" type="email" autocomplete="username" required />
      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required />
      <button type="submit">View logs</button>
    </form>
  </div>
</body>
</html>`);
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
  <meta http-equiv="refresh" content="5" />
  <title>ELVA Support API — Logs</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: #0f172a; color: #e2e8f0; }
    header { padding: 1rem 1.25rem; background: #13294b; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
    h1 { margin: 0 0 0.25rem; font-size: 1.1rem; font-weight: 700; }
    p { margin: 0; color: #94a3b8; font-size: 0.85rem; }
    .actions form { display: inline; }
    .actions button { padding: 0.4rem 0.75rem; border-radius: 6px; border: 1px solid #334155; background: #1e293b; color: #e2e8f0; cursor: pointer; font: inherit; }
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
    <div>
      <h1>ELVA Support API — Live Logs</h1>
      <p>${logs.length} entries · auto-refresh every 5s · ${escapeHtml(env.nodeEnv)}</p>
    </div>
    <div class="actions">
      <form method="post" action="/logs/logout"><button type="submit">Sign out</button></form>
    </div>
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

  if (env.logViewerRequireAuth) {
    const session = getSessionFromRequest(req);
    if (!session) {
      return renderLoginPage(res);
    }
  }

  return renderLogsPage(req, res);
};

const logsViewerLogin = async (req, res) => {
  if (!env.logViewerEnabled) {
    return res.status(404).json({ message: "Route not found" });
  }

  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return renderLoginPage(res, { error: "Email and password are required." });
  }

  try {
    const user = await User.findOne({ email }).select("+password");
    if (!user || !user.isActive || user.role !== ROLES.ADMIN) {
      return renderLoginPage(res, { error: "Invalid admin credentials." });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return renderLoginPage(res, { error: "Invalid admin credentials." });
    }

    const token = signLogsToken(user._id.toString());
    setLogsCookie(res, token);
    logger.info("Logs viewer authenticated", { email: user.email });
    return res.redirect("/");
  } catch (error) {
    logger.error("Logs viewer login failed", { error: error.message });
    return renderLoginPage(res, { error: "Login failed. Try again." });
  }
};

const logsViewerLogout = (req, res) => {
  clearLogsCookie(res);
  return res.redirect("/");
};

module.exports = {
  logsViewerMiddleware,
  logsViewerLogin,
  logsViewerLogout
};
