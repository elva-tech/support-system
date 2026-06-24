const ApiError = require("../../shared/utils/ApiError");
const Application = require("./application.model");

const list = async (filters = {}) => {
  const query = {};

  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive === "true";
  }

  if (filters.search) {
    query.$or = [
      { name: { $regex: filters.search, $options: "i" } },
      { code: { $regex: filters.search, $options: "i" } }
    ];
  }

  return Application.find(query).sort({ name: 1 });
};

const getById = async (id) => {
  const application = await Application.findById(id);

  if (!application) {
    throw new ApiError(404, "Application not found");
  }

  return application;
};

const create = async (data) => {
  return Application.create({
    ...data,
    code: data.code.toUpperCase()
  });
};

const update = async (id, data) => {
  const application = await getById(id);

  if (data.code) {
    data.code = data.code.toUpperCase();
  }

  Object.assign(application, data);
  await application.save();

  return application;
};

const remove = async (id) => {
  const application = await getById(id);
  await application.deleteOne();
  return application;
};

module.exports = { list, getById, create, update, remove };
