/**
 * Lightweight in-process metrics registry (Phase 14).
 * No tenant/user cardinality. Optional Prometheus text exposition.
 */

const counters = new Map();
const histograms = new Map();

const bump = (map, key, amount = 1) => {
  map.set(key, (map.get(key) || 0) + amount);
};

const inc = (name, labels = {}, amount = 1) => {
  const labelKey = Object.keys(labels)
    .sort()
    .map((k) => `${k}=${labels[k]}`)
    .join(",");
  bump(counters, labelKey ? `${name}{${labelKey}}` : name, amount);
};

const observeDuration = (name, durationMs) => {
  const bucket = durationMs < 50 ? "lt50" : durationMs < 200 ? "lt200" : durationMs < 1000 ? "lt1000" : "gte1000";
  bump(histograms, `${name}_count`, 1);
  bump(histograms, `${name}_sum_ms`, durationMs);
  bump(histograms, `${name}_bucket{le="${bucket}"}`, 1);
};

const recordHttpRequest = ({ method, statusCode, durationMs }) => {
  const classKey = `${Math.floor(statusCode / 100)}xx`;
  inc("http_requests_total", { method: String(method || "GET").toUpperCase(), status_class: classKey });
  observeDuration("http_request_duration_ms", durationMs || 0);
  if (statusCode >= 500) {
    inc("http_errors_total", { status_class: "5xx" });
  }
};

const recordAuthFailure = (kind) => {
  inc("auth_failures_total", { kind: kind || "unknown" });
};

const recordRateLimited = (kind) => {
  inc("rate_limited_total", { kind: kind || "unknown" });
};

const snapshot = () => ({
  counters: Object.fromEntries(counters),
  histograms: Object.fromEntries(histograms)
});

const reset = () => {
  counters.clear();
  histograms.clear();
};

/** Prometheus-compatible text (low cardinality labels only). */
const toPrometheusText = () => {
  const lines = [];
  for (const [key, value] of counters.entries()) {
    lines.push(`${key} ${value}`);
  }
  for (const [key, value] of histograms.entries()) {
    lines.push(`${key} ${value}`);
  }
  return `${lines.join("\n")}\n`;
};

module.exports = {
  inc,
  observeDuration,
  recordHttpRequest,
  recordAuthFailure,
  recordRateLimited,
  snapshot,
  reset,
  toPrometheusText
};
