const ROLES = Object.freeze({
  ADMIN: "ADMIN",
  TEAM_LEAD: "TEAM_LEAD",
  AGENT: "AGENT"
});

const ALL_ROLES = Object.values(ROLES);

module.exports = { ROLES, ALL_ROLES };
