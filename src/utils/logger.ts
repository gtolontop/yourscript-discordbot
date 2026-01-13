type LogLevel = "info" | "warn" | "error" | "debug";

const colors = {
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  debug: "\x1b[35m",
  reset: "\x1b[0m",
};

function formatDate(): string {
  return new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function log(level: LogLevel, message: string, ...args: unknown[]): void {
  const color = colors[level];
  const timestamp = formatDate();
  const prefix = `${colors.reset}[${timestamp}] ${color}[${level.toUpperCase()}]${colors.reset}`;

  console.log(prefix, message, ...args);
}

export const logger = {
  info: (message: string, ...args: unknown[]) => log("info", message, ...args),
  warn: (message: string, ...args: unknown[]) => log("warn", message, ...args),
  error: (message: string, ...args: unknown[]) => log("error", message, ...args),
  debug: (message: string, ...args: unknown[]) => log("debug", message, ...args),
};
