const LEVEL_PRIORITY = { debug: 0, info: 1, warn: 2, error: 3 };

const minLevel =
  LEVEL_PRIORITY[
    process.env.LOG_LEVEL ??
      (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
  ] ?? 1;

function write(level, message, meta = {}) {
  if ((LEVEL_PRIORITY[level] ?? 0) < minLevel) return;

  const { err, ...rest } = meta;

  const entry = {
    ts:      new Date().toISOString(),
    level,
    msg:     message,
    service: 'payproof',
    env:     process.env.NODE_ENV ?? 'development',
    ...rest,
  };

  if (err instanceof Error) {
    entry.error = {
      name:    err.name,
      message: err.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    };
  }

  const line = JSON.stringify(entry);

  if (level === 'error') console.error(line);
  else if (level === 'warn')  console.warn(line);
  else                        console.log(line);
}

export const logger = {
  debug : (msg, meta) => write('debug', msg, meta),
  info  : (msg, meta) => write('info',  msg, meta),
  warn  : (msg, meta) => write('warn',  msg, meta),
  error : (msg, meta) => write('error', msg, meta),
};
