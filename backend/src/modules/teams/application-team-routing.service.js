const Team = require("./team.model");
const ApiError = require("../../shared/utils/ApiError");

/** Tickets route to the team linked to the merchant's application. */
const resolveTeamForApplication = async (applicationId) => {
  const team = await Team.findOne({ applicationId, isActive: true }).sort({ name: 1 });

  if (!team) {
    throw new ApiError(
      400,
      "No support team configured for this application. Create a team under Teams and link it to the application."
    );
  }

  return team._id;
};

module.exports = { resolveTeamForApplication };
