const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const parsePagination = (query = {}) => {
  const page = Math.max(DEFAULT_PAGE, parseInt(query.page, 10) || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit, 10) || DEFAULT_LIMIT));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Accepts positional (page, limit, total) or a single object { page, limit, total }.
 * Object form is common across Phase 8–10 services.
 */
const buildPaginationMeta = (pageOrOpts, limit, total) => {
  if (pageOrOpts && typeof pageOrOpts === "object" && !Array.isArray(pageOrOpts)) {
    const page = pageOrOpts.page;
    const lim = pageOrOpts.limit;
    const tot = pageOrOpts.total;
    return {
      page,
      limit: lim,
      total: tot,
      totalPages: tot === 0 ? 0 : Math.ceil(tot / lim)
    };
  }

  return {
    page: pageOrOpts,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit)
  };
};

module.exports = { parsePagination, buildPaginationMeta, DEFAULT_LIMIT, MAX_LIMIT };
