/** Own the generation and pending-verification boundary for effective appearance reads. */
import { CORE_THEME_APPEARANCE, readEffectiveTheme } from "./theme";
import type { EffectiveThemeAppearance } from "../../extensions/theme-contract";
import { createThemeAssetUrls } from "./theme-asset-urls";

export function createAppearanceRequests(waitForWrites: () => Promise<void>, read: () => Promise<unknown>, browserAssets = false) {
  let generation = 0, verificationPending = false;
  // What was last painted, so a re-read that finds the same theme paints nothing (no repaint, and in
  // browser mode no re-fetched fonts and images) - every return to the window re-reads it.
  let painted: string | null = null;
  const assets = createThemeAssetUrls();
  return {
    invalidate(): void { generation++; verificationPending = true; painted = null; assets.release(); },
    needsVerification(): boolean { return verificationPending; },
    async refresh(accept: (appearance: EffectiveThemeAppearance, assetUrls: Record<string, string>) => void): Promise<void> {
      const owner = ++generation;
      try {
        await waitForWrites();
        if (owner !== generation) return;
        const parsed = readEffectiveTheme(await read());
        if (!parsed) throw new Error("invalid effective theme response");
        const key = JSON.stringify(parsed);
        if (key === painted) { verificationPending = false; return; }
        const assetUrls = browserAssets ? await assets.materialize(parsed, () => owner === generation) : {};
        if (!assetUrls) return;
        if (owner !== generation) return;
        verificationPending = false;
        painted = key;
        accept(parsed, assetUrls);
      } catch {
        if (owner !== generation) return;
        verificationPending = false;
        painted = null;
        assets.release();
        accept({ ...CORE_THEME_APPEARANCE, fallbackReason: "invalid-state" }, {});
      }
    },
  };
}
