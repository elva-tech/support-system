const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const nl2br = (value) => escapeHtml(value).replace(/\n/g, "<br/>");

module.exports = { escapeHtml, nl2br };
