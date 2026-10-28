/**
 * A value read once from the app's API when an editor opens (the dice pieces a tool can roll, the scenes a formula can run on). A read that
 * fails is kept as words rather than as an empty list, so a picker never says "none yet" about a library it could not read.
 */
import { useEffect, useState } from "react";
import { toErrorMessage } from "../../../_shared/error-message";

export type Loaded<T> = { state: "loading" } | { state: "failed"; why: string } | { state: "ready"; value: T };

export function useLoaded<T>(load: () => Promise<T>, what: string): Loaded<T> {
  const [loaded, setLoaded] = useState<Loaded<T>>({ state: "loading" });
  useEffect(() => {
    let live = true;
    load().then((value) => { if (live) setLoaded({ state: "ready", value }); }, (e: unknown) => { if (live) setLoaded({ state: "failed", why: toErrorMessage(e, `Could not read ${what}.`) }); });
    return () => { live = false; };
    // read once per mount: the pickers show the library as it was when the editor opened
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return loaded;
}
