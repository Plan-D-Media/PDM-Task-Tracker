import { formatInTimeZone } from "date-fns-tz";
import { publicEnv } from "@/lib/env";

const TZ = publicEnv.timezone; // Asia/Kolkata (Brief §2)

/** Format an ISO timestamp in the app timezone. */
export function fmt(iso: string | null | undefined, pattern = "d MMM, h:mm a") {
  if (!iso) return "—";
  return formatInTimeZone(new Date(iso), TZ, pattern);
}

export function fmtDate(iso: string | null | undefined) {
  return fmt(iso, "d MMM yyyy");
}

export function fmtDateTime(iso: string | null | undefined) {
  return fmt(iso, "d MMM yyyy, h:mm a");
}

/** A task is overdue if its due_date is in the past (caller checks status). */
export function isOverdue(due: string | null | undefined): boolean {
  if (!due) return false;
  return new Date(due).getTime() < Date.now();
}

/** Within the next `hours` (used for due-soon styling). */
export function isDueSoon(due: string | null | undefined, hours = 24): boolean {
  if (!due) return false;
  const t = new Date(due).getTime();
  const now = Date.now();
  return t >= now && t - now <= hours * 3600_000;
}

/** Relative-ish label: Today / Tomorrow / Overdue / date. */
export function dueLabel(due: string | null | undefined): string {
  if (!due) return "No due date";
  const d = new Date(due);
  const now = new Date();
  const dayMs = 86_400_000;
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(d) - startOf(now)) / dayMs);
  if (diffDays === 0) return `Today, ${fmt(due, "h:mm a")}`;
  if (diffDays === 1) return `Tomorrow, ${fmt(due, "h:mm a")}`;
  if (diffDays === -1) return `Yesterday, ${fmt(due, "h:mm a")}`;
  return fmtDate(due);
}

/** Convert a <input type="datetime-local"> value (local wall time) to ISO. */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

/** ISO → value for <input type="datetime-local"> in the app timezone. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return formatInTimeZone(new Date(iso), TZ, "yyyy-MM-dd'T'HH:mm");
}
