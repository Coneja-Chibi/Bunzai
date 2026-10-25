/**
 * Settings, Backups: the calls to the library's care routes (src/ui/server-library-care.ts) and the
 * plain words the screen shows (design/wireframes/backups/index.html): when a copy was made, how big it
 * is, what restoring it would change. Pure, so the wording is tested without a browser.
 */
import { apiFetchJson } from "../../../_shared/api-fetch";

export type CopyKind = "auto" | "manual" | "before-restore";
export interface Copy {
  id: string;
  kind: CopyKind;
  takenAt: number;
  bytes: number;
}
export interface BackupsState {
  unlocked: boolean;
  snapshots: Copy[];
  needsWords: boolean;
  lastError: string | null;
  last: Copy | null;
  totalBytes: number;
  /** Copies made with Back up now, and how many are allowed before one must be removed. */
  manual: { count: number; cap: number };
}
export interface Diff {
  now: number;
  inSnapshot: number;
  onlyNow: number;
  onlySnapshot: number;
  changed: number;
}
export interface Preview {
  snapshot: Copy;
  schema: "same" | "older";
  chats: Diff;
  cards: Diff;
  messages: Diff;
  otherPieces: Diff;
}
export interface Restored {
  ok: true;
  restored: Copy;
  undo: Copy;
  sealOwed: string | null;
}

const post = <T>(path: string, body: unknown = {}): Promise<T> =>
  apiFetchJson<T>(`/api/library/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const backupsApi = {
  state: () => apiFetchJson<BackupsState>("/api/library/backups", { requireToken: false }),
  take: () => post<{ ok: true; snapshot: Copy }>("backups/take"),
  preview: (id: string) => post<Preview>("backups/preview", { id }),
  restore: (id: string) => post<Restored>("backups/restore", { id }),
  remove: (id: string) => post<{ ok: true }>("backups/remove", { id }),
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const sameDay = (a: Date, b: Date): boolean => a.toDateString() === b.toDateString();

const clock = (d: Date): string => `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "am" : "pm"}`;
/** "Today, 3:12 pm" or "Sun 4 Oct, 11:00 pm": a copy is named by when it was made. */
export function whenLabel(ms: number, now = Date.now()): string {
  const d = new Date(ms);
  return sameDay(d, new Date(now)) ? `Today, ${clock(d)}` : `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}, ${clock(d)}`;
}
/** "Mon 5 Oct 2026". */
export const dayLabel = (ms: number): string => {
  const d = new Date(ms);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
/** "138 MB", "4.2 GB". */
export function sizeLabel(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  return `${Math.max(1, Math.round(bytes / 1e3))} kB`;
}
/** "12 minutes ago", "3 hours ago". */
export function agoLabel(ms: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - ms) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export const KIND_CHIP: Readonly<Record<CopyKind, { label: string; tone: "plain" | "ok" | "warn" }>> = {
  auto: { label: "Hourly", tone: "plain" },
  manual: { label: "Made by you", tone: "ok" },
  "before-restore": { label: "Before a restore", tone: "warn" },
};

/** What is kept, in words: copies made by you count against a cap; safety copies stay until the person removes them. */
export const keptWords = (manual: { count: number; cap: number }, safety: number): string =>
  `The last 24 hourly copies, 7 daily, and 4 weekly; older ones are cleared automatically. Copies made by you stay until you remove them (${manual.count} of ${manual.cap}). ` +
  (safety > 0 ? `The ${safety === 1 ? "copy" : "copies"} saved before a restore stay as long as they hold newer work than the rest; each can be moved to the trash.` : "Each copy saved before a restore stays as long as it holds newer work than the rest.");

/** Only copies the person can reasonably let go of get a Remove button: their own, and the safety copies. */
export const removable = (c: Copy): boolean => c.kind !== "auto";

/** "1 would be set aside, 2 would be rewound": set aside is in the library now and not in the copy, rewound is in both but changed since. */
export function changeWords(d: Diff): string {
  const parts = [
    d.onlyNow > 0 ? `${d.onlyNow} would be set aside` : null,
    d.changed > 0 ? `${d.changed} would be rewound` : null,
    d.onlySnapshot > 0 ? `${d.onlySnapshot} would come back` : null,
  ].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(" · ") : "no change";
}

const n = (v: number): string => v.toLocaleString("en-GB");
export interface PreviewRow {
  name: string;
  meta: string;
  status: string;
}
/** The four rows of the restore dialog. */
export function previewRows(p: Preview): PreviewRow[] {
  const counts = (d: Diff): string => `${n(d.now)} now, ${n(d.inSnapshot)} in the copy`;
  return [
    { name: "Chats", meta: counts(p.chats), status: changeWords(p.chats) },
    { name: "Cards", meta: counts(p.cards), status: changeWords(p.cards) },
    { name: "Messages", meta: counts(p.messages), status: changeWords(p.messages) },
    { name: "Other pieces", meta: "Lorebooks, personas, presets and the rest", status: changeWords(p.otherPieces) },
  ];
}

/** A refusal in the wireframe's words: a theatrical label, then the server's plain sentence. */
export function refusalLabel(message: string): string {
  if (/free disk|disk space/i.test(message)) return "No room in the wings";
  if (/different version/i.test(message)) return "Made by another version";
  if (/library's key|another library/i.test(message)) return "Not this library";
  return "Missed cue";
}
