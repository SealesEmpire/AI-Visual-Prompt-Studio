import "server-only";

export type ConfigurationState = "CONFIGURED" | "PARTIALLY_CONFIGURED" | "NOT_CONFIGURED" | "INVALID";

export interface ConfigurationGroup {
  state: ConfigurationState;
  configured: boolean;
  present: string[];
  missing: string[];
  error?: string;
}

const groups = {
  application: ["NEXTAUTH_URL", "GENERATION_WORKER_URL"],
  database: ["DATABASE_URL"],
  authentication: ["NEXTAUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
  openai: ["OPENAI_API_KEY", "OPENAI_ANALYSIS_MODEL", "OPENAI_PROMPT_MODEL", "OPENAI_IMAGE_MODEL"],
  runpod: ["RUNPOD_API_KEY", "RUNPOD_ENDPOINT_ID", "RUNPOD_INPUT_TEMPLATE", "RUNPOD_CAPABILITIES_JSON", "RUNPOD_ASSET_HOSTS"],
  objectStorage: ["S3_ENDPOINT", "S3_REGION", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_BUCKET"],
  security: ["NEXTAUTH_SECRET", "ENCRYPTION_KEY", "GENERATION_WORKER_SECRET"],
} as const;

export type ServerConfigurationGroup = keyof typeof groups;

export function getConfigurationStatus(group: ServerConfigurationGroup): ConfigurationGroup {
  const keys = groups[group];
  const present = keys.filter((key) => Boolean(process.env[key]?.trim()));
  const missing = keys.filter((key) => !process.env[key]?.trim());
  let error: string | undefined;

  if (group === "application" && process.env.NEXTAUTH_URL && !isHttpUrl(process.env.NEXTAUTH_URL)) {
    error = "NEXTAUTH_URL must be an HTTP or HTTPS URL.";
  }
  if (group === "database" && process.env.DATABASE_URL && !isPostgresUrl(process.env.DATABASE_URL)) {
    error = "DATABASE_URL must use the PostgreSQL protocol.";
  }
  if (group === "objectStorage" && process.env.S3_ENDPOINT && !isHttpUrl(process.env.S3_ENDPOINT)) {
    error = "S3_ENDPOINT must be an HTTP or HTTPS URL.";
  }
  if (group === "runpod" && present.length > 0 && !isValidRunPodEnvironment()) {
    error = "RunPod settings are incomplete or invalid.";
  }
  if (group === "security" && process.env.ENCRYPTION_KEY && !/^[0-9a-f]{64}$/i.test(process.env.ENCRYPTION_KEY)) {
    error = "ENCRYPTION_KEY must be 32 bytes encoded as 64 hexadecimal characters.";
  }
  if (group === "security" && (
    (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.length < 32) ||
    (process.env.GENERATION_WORKER_SECRET && process.env.GENERATION_WORKER_SECRET.length < 32)
  )) {
    error = "NEXTAUTH_SECRET and GENERATION_WORKER_SECRET must each be at least 32 characters.";
  }
  if (group === "authentication" && present.length > 0 && !isValidAuthEnvironment()) {
    error = "Authentication requires NEXTAUTH_SECRET and a complete Google or GitHub client pair.";
  }
  if (group === "openai" && present.length > 0 && !process.env.OPENAI_API_KEY) {
    error = "OpenAI model settings require OPENAI_API_KEY.";
  }

  const state: ConfigurationState = error
    ? "INVALID"
    : present.length === 0
      ? "NOT_CONFIGURED"
      : missing.length === 0 || isOptionalGroupConfigured(group)
        ? "CONFIGURED"
        : "PARTIALLY_CONFIGURED";

  return { state, configured: state === "CONFIGURED", present, missing, ...(error ? { error } : {}) };
}

export function getPublicConfigurationStatus(): Record<ServerConfigurationGroup, ConfigurationGroup> {
  return Object.fromEntries(Object.keys(groups).map((group) => [
    group,
    getConfigurationStatus(group as ServerConfigurationGroup),
  ])) as Record<ServerConfigurationGroup, ConfigurationGroup>;
}

function isOptionalGroupConfigured(group: ServerConfigurationGroup): boolean {
  if (group === "authentication") {
    return Boolean(process.env.NEXTAUTH_SECRET && (
      (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) ||
      (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)
    ));
  }
  if (group === "openai") return Boolean(process.env.OPENAI_API_KEY);
  return false;
}

function isValidAuthEnvironment(): boolean {
  const googlePartial = Boolean(process.env.GOOGLE_CLIENT_ID) !== Boolean(process.env.GOOGLE_CLIENT_SECRET);
  const githubPartial = Boolean(process.env.GITHUB_CLIENT_ID) !== Boolean(process.env.GITHUB_CLIENT_SECRET);
  return !googlePartial && !githubPartial && Boolean(
    process.env.NEXTAUTH_SECRET &&
    ((process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) ||
      (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)),
  );
}

function isValidRunPodEnvironment(): boolean {
  if (groups.runpod.some((key) => !process.env[key]?.trim())) return false;
  try {
    const template: unknown = JSON.parse(process.env.RUNPOD_INPUT_TEMPLATE!);
    const capabilities: unknown = JSON.parse(process.env.RUNPOD_CAPABILITIES_JSON!);
    return isRecord(template) && isRecord(capabilities) &&
      /^[a-zA-Z0-9_-]{1,128}$/.test(process.env.RUNPOD_ENDPOINT_ID!) &&
      process.env.RUNPOD_ASSET_HOSTS!.split(",").every((host) => /^[a-zA-Z0-9.-]+$/.test(host.trim()));
  } catch {
    return false;
  }
}

function isHttpUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isPostgresUrl(value: string): boolean {
  try {
    return ["postgres:", "postgresql:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
