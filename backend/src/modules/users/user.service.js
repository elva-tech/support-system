const ApiError = require("../../shared/utils/ApiError");
const User = require("./user.model");
const Team = require("../teams/team.model");
const Application = require("../applications/application.model");

const populateOptions = [
  { path: "teamId", select: "name" },
  { path: "applicationIds", select: "name code" }
];

const validateReferences = async ({ teamId, applicationIds }) => {
  if (teamId) {
    const team = await Team.findById(teamId);
    if (!team) {
      throw new ApiError(400, "Team not found");
    }
  }

  if (applicationIds?.length) {
    const applications = await Application.find({ _id: { $in: applicationIds } });
    if (applications.length !== applicationIds.length) {
      throw new ApiError(400, "One or more applications not found");
    }
  }
};

const list = async (filters = {}) => {
  const query = {};

  if (filters.role) {
    query.role = filters.role;
  }

  if (filters.teamId) {
    query.teamId = filters.teamId;
  }

  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive === "true";
  }

  if (filters.search) {
    query.$or = [
      { firstName: { $regex: filters.search, $options: "i" } },
      { lastName: { $regex: filters.search, $options: "i" } },
      { email: { $regex: filters.search, $options: "i" } }
    ];
  }

  return User.find(query).populate(populateOptions).sort({ lastName: 1, firstName: 1 });
};

const getById = async (id) => {
  const user = await User.findById(id).populate(populateOptions);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
};

const create = async (data) => {
  const existing = await User.findOne({ email: data.email });

  if (existing) {
    throw new ApiError(409, "Email already exists");
  }

  await validateReferences(data);
  const user = await User.create(data);
  return User.findById(user._id).populate(populateOptions);
};

const update = async (id, data) => {
  const user = await User.findById(id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (data.email && data.email !== user.email) {
    const existing = await User.findOne({ email: data.email });
    if (existing) {
      throw new ApiError(409, "Email already exists");
    }
  }

  await validateReferences({ ...user.toObject(), ...data });

  if (data.password) {
    user.password = data.password;
    delete data.password;
  }

  Object.assign(user, data);
  await user.save();

  return User.findById(id).populate(populateOptions);
};

const remove = async (id, currentUserId) => {
  if (id === currentUserId.toString()) {
    throw new ApiError(400, "Cannot delete your own account");
  }

  const user = await getById(id);
  await user.deleteOne();
  return user;
};

module.exports = { list, getById, create, update, remove };
