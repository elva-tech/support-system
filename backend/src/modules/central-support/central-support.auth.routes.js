const express = require("express");
const { body } = require("express-validator");
const validate = require("../../shared/middleware/validate.middleware");
const asyncHandler = require("../../shared/utils/asyncHandler");
const {
  authenticateCentralSupport
} = require("../../shared/middleware/central-support-auth.middleware");
const authService = require("./central-support-auth.service");

const router = express.Router();

router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isString().isLength({ min: 1 })
  ],
  validate,
  asyncHandler(async (req, res) => {
    const data = await authService.login(req.body.email, req.body.password);
    res.json({ message: "Signed in", data });
  })
);

router.get(
  "/me",
  authenticateCentralSupport,
  asyncHandler(async (req, res) => {
    const data = await authService.getMe(req.centralSupportUser._id);
    res.json({ message: "OK", data });
  })
);

module.exports = router;
