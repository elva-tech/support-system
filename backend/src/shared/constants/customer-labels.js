/**
 * Presentation-level customer terminology (Phase 12).
 * Does not rename MerchantProfile or APIs — UI labels only.
 */

const CUSTOMER_LABELS = Object.freeze({
  CLIENT: "CLIENT",
  CUSTOMER: "CUSTOMER",
  MERCHANT: "MERCHANT"
});

const ALL_CUSTOMER_LABELS = Object.freeze(Object.values(CUSTOMER_LABELS));

const DEFAULT_CUSTOMER_LABEL = CUSTOMER_LABELS.CLIENT;

const CUSTOMER_LABEL_COPY = Object.freeze({
  [CUSTOMER_LABELS.CLIENT]: {
    singular: "Client",
    plural: "Clients",
    add: "Add Client",
    details: "Client Details",
    empty: "No clients registered yet."
  },
  [CUSTOMER_LABELS.CUSTOMER]: {
    singular: "Customer",
    plural: "Customers",
    add: "Add Customer",
    details: "Customer Details",
    empty: "No customers registered yet."
  },
  [CUSTOMER_LABELS.MERCHANT]: {
    singular: "Merchant",
    plural: "Merchants",
    add: "Add Merchant",
    details: "Merchant Details",
    empty: "No merchants registered yet."
  }
});

const normalizeCustomerLabel = (value) => {
  const raw = String(value || "")
    .trim()
    .toUpperCase();
  if (ALL_CUSTOMER_LABELS.includes(raw)) {
    return raw;
  }
  return DEFAULT_CUSTOMER_LABEL;
};

const isValidCustomerLabel = (value) =>
  ALL_CUSTOMER_LABELS.includes(String(value || "").trim().toUpperCase());

const getCustomerLabelCopy = (label) =>
  CUSTOMER_LABEL_COPY[normalizeCustomerLabel(label)] ||
  CUSTOMER_LABEL_COPY[DEFAULT_CUSTOMER_LABEL];

module.exports = {
  CUSTOMER_LABELS,
  ALL_CUSTOMER_LABELS,
  DEFAULT_CUSTOMER_LABEL,
  CUSTOMER_LABEL_COPY,
  normalizeCustomerLabel,
  isValidCustomerLabel,
  getCustomerLabelCopy
};
