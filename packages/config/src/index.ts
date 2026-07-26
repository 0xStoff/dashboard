export type RuntimeName = "api" | "worker";

export interface DatabaseConfig {
  url: string;
  poolMax: number;
  statementTimeoutMs: number;
}

export interface RuntimeConfig {
  runtime: RuntimeName;
  environment: "development" | "test" | "production";
  host: string;
  port: number;
  logLevel: "trace" | "debug" | "info" | "warn" | "error";
  database: DatabaseConfig;
}

export function loadRuntimeConfig(runtime: RuntimeName, source: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const environment = enumValue(source.NODE_ENV ?? "development", ["development", "test", "production"] as const, "NODE_ENV");
  return {
    runtime,
    environment,
    host: source.HOST?.trim() || "127.0.0.1",
    port: integer(source.PORT ?? (runtime === "api" ? "4000" : "4001"), "PORT", 1, 65_535),
    logLevel: enumValue(source.LOG_LEVEL ?? "info", ["trace", "debug", "info", "warn", "error"] as const, "LOG_LEVEL"),
    database: {
      url: required(source.DATABASE_URL, "DATABASE_URL"),
      poolMax: integer(source.DATABASE_POOL_MAX ?? "10", "DATABASE_POOL_MAX", 1, 100),
      statementTimeoutMs: integer(source.DATABASE_STATEMENT_TIMEOUT_MS ?? "15000", "DATABASE_STATEMENT_TIMEOUT_MS", 100, 300_000),
    },
  };
}

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

function integer(value: string, name: string, min: number, max: number): number {
  if (!/^[0-9]+$/.test(value)) throw new Error(`${name} must be an integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
  return parsed;
}

function enumValue<const T extends readonly string[]>(value: string, choices: T, name: string): T[number] {
  if (!choices.includes(value)) throw new Error(`${name} must be one of ${choices.join(", ")}`);
  return value as T[number];
}
