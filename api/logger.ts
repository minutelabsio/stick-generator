/* eslint-disable no-console -- the logger facade is the one place console is allowed */

type LogFields = Record<string, unknown>

// Workers Logs indexes object arguments, so fields stay queryable in the dashboard.
export const logger = {
  info: (message: string, fields: LogFields = {}) => console.info({ message, ...fields }),
  warn: (message: string, fields: LogFields = {}) => console.warn({ message, ...fields }),
  error: (message: string, fields: LogFields = {}) => console.error({ message, ...fields }),
}
