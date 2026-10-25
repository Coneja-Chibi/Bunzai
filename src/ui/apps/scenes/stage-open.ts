/**
 * How a prop's mini player asks the scene to open its tab: RoleCall's chevron on the mini players opens the Stage wing on the Music or
 * Spotify tab (StandardLayout.tsx:2423-2442). A Prop's Stage piece only gets `{ ctx, chat }`, so it sends this window event and the
 * scene page (which owns the open wing) and the Stage wing (which owns the active tab) answer it.
 */
export const STAGE_OPEN_EVENT = "bunraku:stage-open";
export interface StageOpenDetail { tab: "music" | "spotify" }

export function openStageTab(tab: StageOpenDetail["tab"]): void {
  window.dispatchEvent(new CustomEvent<StageOpenDetail>(STAGE_OPEN_EVENT, { detail: { tab } }));
}

let sequence = 0;
/** Numbers each request across the whole page, so a scene opened later never reuses a number the Stage wing already honoured. */
export const nextStageRequest = (): number => ++sequence;
