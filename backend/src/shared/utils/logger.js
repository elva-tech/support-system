const MAX_LOG_ENTRIES = 1000;
const entries = [];

const formatMessage = (level, message, meta) => {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  if (!meta) return base;
  return `${base} ${JSON.stringify(meta)}`;
};

const pushEntry = (level, message, meta) => {
  const line = formatMessage(level, message, meta);
  entries.push({ level, line, timestamp: new Date().toISOString() });
  if (entries.length > MAX_LOG_ENTRIES) {
    entries.shift();
  }
  return line;
};

const logger = {
  info(message, meta) {
    const line = pushEntry("info", message, meta);
    console.log(line);
  },
  warn(message, meta) {
    const line = pushEntry("warn", message, meta);
    console.warn(line);
  },
  error(message, meta) {
    const line = pushEntry("error", message, meta);
    console.error(line);
  },
  debug(message, meta) {
    if (process.env.NODE_ENV !== "production") {
      const line = pushEntry("debug", message, meta);
      console.debug(line);
    }
  },
  getEntries() {
    return [...entries];
  },
  clear() {
    entries.length = 0;
  }
};

module.exports = logger;
