/**
 * The pop-out contract (docs/reference/ui.md, "Pop-outs"). A kind is a first-party panel that can float over the scene: a Prop lists
 * its kinds in `SceneProp.popouts`, a wing adds its own in `kinds.ts`. The host (popout-host.tsx) gives each kind one floating panel
 * per scene; the kind only says what the panel holds.
 */
import type { JSX } from "react";
import type { Chat } from "../../../../stage/contracts/chat-store";
import type { AppContext } from "../../../app-contract";
import type { IconName } from "../../../_shared/ic";

export interface PopoutContext {
  /** The kind's id, for PopoutButton. */
  id: string;
  ctx: AppContext;
  chat: Chat;
  /** Takes the scene's chat back from a write the content made, so the scene and the other surfaces see it. */
  onChat?(chat: Chat): void;
  /** Set only while the content is docked: draw a PopoutButton wired to it. The floating copy gets none. */
  popOut?: () => void;
}

export interface PopoutKind {
  /** Unique, 1 to 64 characters of [a-z0-9.-]; the prefs key `popout.<id>` remembers its open state and place. */
  id: string;
  /** The floating panel's header. */
  title: string;
  /** The docked spot's placeholder reads "<noun> is floating". */
  noun: string;
  icon: IconName;
  /** Panel width in px (RoleCall's Activity feed is 380). */
  width?: number;
  /** First open position, px from the top (RoleCall opens at 100); the panel starts at the right edge. Give kinds different values so they do not stack. */
  top?: number;
  /** Draws the content. It fetches its own data from `ctx` and `chat`, and is the same content docked and floating. */
  render(c: PopoutContext): JSX.Element;
}

/** A pop-out's saved state: `pos` is null until the person has dragged it (then it opens at the kind's default place). */
export interface PopoutState {
  open: boolean;
  pos: { x: number; y: number } | null;
}
