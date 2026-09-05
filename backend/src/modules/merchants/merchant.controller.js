const asyncHandler = require("../../shared/utils/asyncHandler");
const merchantService = require("./merchant.service");

const tenantCtx = (req) => ({ tenantId: req.tenant._id });

const requestOtp = asyncHandler(async (req, res) => {
  const result = await merchantService.requestOtp(req.body.email, tenantCtx(req));
  res.json(result);
});

const verifyOtp = asyncHandler(async (req, res) => {
  const { email, otpCode } = req.body;
  const result = await merchantService.verifyOtp(
    email,
    otpCode,
    {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || ""
    },
    tenantCtx(req)
  );

  res.json({
    message: "OTP verified successfully",
    data: result
  });
});

const getMe = asyncHandler(async (req, res) => {
  res.json({ data: req.merchant });
});

const logout = asyncHandler(async (req, res) => {
  const token = req.headers["x-merchant-session"];
  if (token) {
    await merchantService.logout(token);
  }
  res.json({ message: "Logged out successfully" });
});

module.exports = { requestOtp, verifyOtp, getMe, logout };
