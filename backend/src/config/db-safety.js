/**
 * Refuse destructive DB operations outside isolated test/local databases.
 */
const isSafeTestUri = (uri) => {
  if (!uri) return false;
  const normalized = uri.toLowerCase();
  return (
    normalized.includes("127.0.0.1") ||
    normalized.includes("localhost") ||
    normalized.includes("mongodb-memory-server") ||
    normalized.includes("memoryserver")
  );
};

const getDatabaseName = (uri) => {
  if (!uri) return "unknown";
  const withoutQuery = uri.split("?")[0];
  const parts = withoutQuery.split("/");
  return parts[parts.length - 1] || "unknown";
};

const assertSafeToDrop = (uri) => {
  if (!isSafeTestUri(uri)) {
    throw new Error(
      `Refusing to drop database — tests must use MongoMemoryServer, not your dev/production cluster (${getDatabaseName(uri)})`
    );
  }
};

module.exports = { isSafeTestUri, getDatabaseName, assertSafeToDrop };
