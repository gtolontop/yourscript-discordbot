type LogLevel = "info" | "warn" | "error" | "debug" | "cmd" | "event" | "db";

const colors: Record<string, string> = {
  info: "\x1b[36m",    // Cyan
  warn: "\x1b[33m",    // Yellow
  error: "\x1b[31m",   // Red
  debug: "\x1b[35m",   // Magenta
  cmd: "\x1b[32m",     // Green
  event: "\x1b[34m",   // Blue
  db: "\x1b[33m",      // Yellow
  reset: "\x1b[0m",
  dim: "\x1b[2m",
};

function formatDate(): string {
  return new Date().toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function log(level: LogLevel, ...args: unknown[]): void {
  const message = args[0] as string;
  const rest = args.slice(1);
  const color = colors[level] ?? colors['info'];
  const timestamp = formatDate();
  const prefix = `${colors['reset']}[${timestamp}] ${color}[${level.toUpperCase()}]${colors['reset']}`;

  console.log(prefix, message, ...rest);
}

export const logger = {
  info: (message: string, ...args: unknown[]) => log("info", message, ...args),
  warn: (message: string, ...args: unknown[]) => log("warn", message, ...args),
  error: (message: string, ...args: unknown[]) => log("error", message, ...args),
  debug: (message: string, ...args: unknown[]) => log("debug", message, ...args),
  cmd: (message: string, ...args: unknown[]) => log("cmd", message, ...args),
  event: (message: string, ...args: unknown[]) => log("event", message, ...args),
  db: (message: string, ...args: unknown[]) => log("db", message, ...args),
};
