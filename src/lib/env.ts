/**
 * Centralised, validated environment access.
 *
 * Split into `publicEnv` (safe in the browser bundle) and `serverEnv`
 * (throws if read from client code). This is the first line of defence
 * for House Rule §11: the service-role key must never reach the client.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const publicEnv = {
  supabaseUrl: required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  supabaseAnonKey: required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  allowedEmailDomain: (
    process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN ?? "pland.in"
  ).toLowerCase(),
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  timezone: process.env.NEXT_PUBLIC_APP_TIMEZONE ?? "Asia/Kolkata",
} as const;

/**
 * Server-only secrets. Reading any of these throws if it somehow runs in
 * the browser, so an accidental client import fails loudly instead of
 * silently shipping a secret.
 */
export const serverEnv = {
  get serviceRoleKey(): string {
    if (typeof window !== "undefined") {
      throw new Error("serverEnv.serviceRoleKey was read in the browser");
    }
    return required(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  },
  get resendApiKey(): string | undefined {
    if (typeof window !== "undefined") {
      throw new Error("serverEnv.resendApiKey was read in the browser");
    }
    return process.env.RESEND_API_KEY;
  },
  get alarmFromEmail(): string {
    return process.env.ALARM_FROM_EMAIL ?? "PlanDesk Alarms <alarms@pland.in>";
  },
  get cronSecret(): string {
    if (typeof window !== "undefined") {
      throw new Error("serverEnv.cronSecret was read in the browser");
    }
    return required("CRON_SECRET", process.env.CRON_SECRET);
  },
} as const;
