/** The scene page's wing shell in one call: the root the widths are written on, each wing's width and drag handle, and the outside press that closes the open wing. */
import { useRef } from "react";
import type { AppContext } from "../../app-contract";
import { useWingWidths } from "./use-wing-widths";
import { useWingDismiss } from "./wing-dismiss";

export function useWingShell(prefs: AppContext["prefs"], wing: string | null, setWing: (id: string | null) => void) {
  const root = useRef<HTMLDivElement>(null);
  useWingDismiss(wing !== null, root, () => setWing(null));
  return { root, ...useWingWidths(prefs, root) };
}
