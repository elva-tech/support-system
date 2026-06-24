const formatMessage = (level, message, meta) => {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  if (!meta) return base;
  return `${base} ${JSON.stringify(meta)}`;
};

const logger = {
  info(message, meta) {
    console.log(formatMessage("info", message, meta));
  },
  warn(message, meta) {
    console.warn(formatMessage("warn", message, meta));
  },
  error(message, meta) {
    console.error(formatMessage("error", message, meta));
  },
  debug(message, meta) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(formatMessage("debug", message, meta));
    }
  }
};

module.exports = logger;
