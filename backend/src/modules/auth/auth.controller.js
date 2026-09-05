const asyncHandler = require("../../shared/utils/asyncHandler");
const authService = require("./auth.service");
const { SECURITY_EVENTS, logSecurityEvent } = require("../../shared/observability/security-events");

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await authService.login(email, password, {
      tenantId: req.tenant._id
    });

    logSecurityEvent(SECURITY_EVENTS.AUTH_LOGIN_SUCCEEDED, req, {
      userId: result.user?._id ? String(result.user._id) : undefined
    });

    res.json({
      message: "Login successful",
      data: result
    });
  } catch (err) {
    if (err.statusCode === 401) {
      logSecurityEvent(SECURITY_EVENTS.AUTH_LOGIN_FAILED, req, {
        reason: "invalid_credentials"
      });
    }
    throw err;
  }
});

const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user._id);

  res.json({ data: user });
});

module.exports = { login, getMe };
