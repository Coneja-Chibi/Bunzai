/** How long a deleted piece, scene, or take stays restorable before it is gone for good (RoleCall's window). */
export const TRASH_DAYS = 3;

/** How long a cut message stays restorable. Shorter than the rest: a cut is a small edit, not a deleted thing. */
export const CUT_MESSAGE_TRASH_DAYS = 1;

const DAY_MS = 86_400_000;

/** The oldest deletion time still inside a window: anything deleted before this is past it. */
export function trashCutoff(now: number, days: number): number {
  return now - days * DAY_MS;
}

/** The time a deleted thing has left in the Trash, short: "2d left", "5h left", "under 1h left". */
export function daysLeft(deletedAt: number, now: number, days: number = TRASH_DAYS): string {
  const hours = Math.floor((deletedAt + days * DAY_MS - now) / 3_600_000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d left`;
  return hours >= 1 ? `${hours}h left` : "under 1h left";
}
