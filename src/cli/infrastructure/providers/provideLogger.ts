import { createLogger, transports, format } from "winston";

export const provideLogger = () => {
  return createLogger({
    transports: [new transports.Console()],
    format: format.combine(
      format.colorize(),
      format.timestamp(),
      format.printf(({ timestamp, level, message }) => {
        return `[${timestamp}] ${level}: ${message}`;
      })
    ),
  });
};