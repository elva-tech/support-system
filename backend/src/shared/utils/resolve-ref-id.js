const resolveRefId = (ref) => {
  if (ref == null) {
    return null;
  }

  if (typeof ref === "object" && ref._id != null) {
    return ref._id.toString();
  }

  return ref.toString();
};

module.exports = resolveRefId;
