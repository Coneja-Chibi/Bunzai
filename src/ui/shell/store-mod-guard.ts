/**
 * Wires the protected-layer watchdog to the shell store: a mod that hides or covers a protected prompt is dropped
 * at once, marked broken on the host (a later enable needs fresh approval), and the page repainted from the
 * host's answer. Imported once for its effect, by the shell root.
 */
import { apiFetchJson } from "../_shared/api-fetch";
import { useShellStore } from "./store";
import { setModHandlers } from "./theme-mod";

const postTheme = (path: string, body: Record<string, unknown>): Promise<unknown> =>
  apiFetchJson(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => undefined);

export function installModGuard(): void {
  setModHandlers({
    broken: (info) => {
      useShellStore.getState().invalidateAppearance();
      useShellStore.setState({ statusNote: "A theme covered a protected prompt, so Bunraku turned it off." });
      void postTheme("/api/themes/broken", { id: info.themeId, digest: info.digest }).then(() => useShellStore.getState().refreshAppearance());
    },
    healthy: (info) => { void postTheme("/api/themes/healthy", { digest: info.digest }); },
  });
}
