const asyncHandler = require("../../shared/utils/asyncHandler");
const authService = require("./auth.service");

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password);

  res.json({
    message: "Login successful",
    data: result
  });
});

const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user._id);

  res.json({ data: user });
});

module.exports = { login, getMe };
