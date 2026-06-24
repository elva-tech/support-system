const mongoose = require("mongoose");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildQueueQuery = (filters = {}) => {
  const query = {};

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.application) {
    if (mongoose.Types.ObjectId.isValid(filters.application)) {
      query.applicationId = filters.application;
    } else {
      query.applicationCode = filters.application.toUpperCase();
    }
  }

  if (filters.applicationCode) {
    query.applicationCode = filters.applicationCode.toUpperCase();
  }

  if (filters.applicationId) {
    query.applicationId = filters.applicationId;
  }

  if (filters.module || filters.moduleId) {
    query.moduleId = filters.module || filters.moduleId;
  }

  if (filters.team || filters.teamId) {
    query.teamId = filters.team || filters.teamId;
  }

  if (filters.assignedTo) {
    if (filters.assignedTo === "unassigned") {
      query.assignedTo = null;
    } else {
      query.assignedTo = filters.assignedTo;
    }
  }

  return query;
};

const applySearchFilter = async (query, search) => {
  const term = search?.trim();
  if (!term) {
    return query;
  }

  const MerchantProfile = require("../merchants/merchant-profile.model");
  const safeTerm = escapeRegex(term);

  const merchants = await MerchantProfile.find({
    $or: [
      { merchantName: { $regex: safeTerm, $options: "i" } },
      { email: { $regex: safeTerm, $options: "i" } }
    ]
  }).select("_id");

  const orConditions = [
    { ticketNumber: { $regex: safeTerm, $options: "i" } },
    { subject: { $regex: safeTerm, $options: "i" } }
  ];

  if (merchants.length) {
    orConditions.push({ merchantId: { $in: merchants.map((merchant) => merchant._id) } });
  }

  if (Object.keys(query).length === 0) {
    return { $or: orConditions };
  }

  return { $and: [query, { $or: orConditions }] };
};

module.exports = { buildQueueQuery, applySearchFilter };
