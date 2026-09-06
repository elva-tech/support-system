const mongoose = require("mongoose");
const { COLLABORATION_ENQUIRY_STATUSES } = require("../../shared/constants/platform-support");

const collaborationEnquirySchema = new mongoose.Schema(
  {
    organizationName: { type: String, required: true, trim: true, maxlength: 200 },
    contactPerson: { type: String, required: true, trim: true, maxlength: 200 },
    businessEmail: { type: String, required: true, lowercase: true, trim: true, maxlength: 200 },
    phone: { type: String, default: "", trim: true, maxlength: 50 },
    organizationWebsite: { type: String, default: "", trim: true, maxlength: 300 },
    expectedTeamSize: { type: String, default: "", trim: true, maxlength: 50 },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    status: {
      type: String,
      enum: Object.values(COLLABORATION_ENQUIRY_STATUSES),
      default: COLLABORATION_ENQUIRY_STATUSES.NEW,
      index: true
    },
    sourceHost: { type: String, default: "", trim: true },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  {
    timestamps: true,
    collection: "collaborationenquiries"
  }
);

collaborationEnquirySchema.index({ createdAt: -1 });
collaborationEnquirySchema.index({ businessEmail: 1, createdAt: -1 });

module.exports = mongoose.model("CollaborationEnquiry", collaborationEnquirySchema);
