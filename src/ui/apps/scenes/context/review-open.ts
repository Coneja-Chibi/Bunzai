/**
 * The Review tile's way back to a paused turn (RoleCall `model-call-inspector/navigation.ts`: navigation only, no payload and no authority travels with
 * it). The Prompt Inspector dialog (scene-inspector.tsx) answers the event by reopening itself and marking it handled; an event nobody handled means no turn
 * is paused, and the wing says so (RoleCall: "No calls are awaiting review.").
 */
export const OPEN_REVIEW = "bunraku:open-prompt-review";

/** Asks any paused Prompt Inspector review to reopen; true when one did. */
export function requestReview(): boolean {
  const detail = { handled: false };
  window.dispatchEvent(new CustomEvent(OPEN_REVIEW, { detail }));
  return detail.handled;
}
