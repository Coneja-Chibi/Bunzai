/**
 * Whether the Story Director is on for a scene, for the Booth's third status tile (RoleCall's "Story Director: On or Off", QuickPlayPanel.tsx:1674). Read from the scene's
 * Props switch (the same one the Narrator row flips); read again when `tick` changes, which the Booth bumps when the Props changed. A read that fails reads as off.
 */
import { useEffect, useState } from "react";
import type { AppContext } from "../../app-contract";
import { DIRECTOR_PROP_ID } from "../../../core/director/settings";

export function useDirectorOn(ctx: AppContext, chatId: string, tick: number): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.resolve().then(() => ctx.api.getSceneProps(chatId)).then((p) => live && setOn(p.on.includes(DIRECTOR_PROP_ID)), () => live && setOn(false));
    return () => { live = false; };
  }, [ctx, chatId, tick]);
  return on;
}
