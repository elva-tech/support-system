const { escapeHtml, nl2br } = require("./escape");
const layout = require("./layout");
const templates = require("./templates");

module.exports = {
  escapeHtml,
  nl2br,
  ...layout,
  ...templates
};
