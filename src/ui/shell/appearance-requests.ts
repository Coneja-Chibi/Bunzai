/** Own the generation and pending-verification boundary for effective appearance reads. */
import { CORE_THEME_APPEARANCE, readEffectiveTheme } from "./theme";
import type { EffectiveThemeAppearance } from "../../extensions/theme-contract";
import { createThemeAssetUrls } from "./theme-asset-urls";

export function createAppearanceRequests(waitForWrites: () => Promise<void>, read: () => Promise<unknown>, browserAssets = false) {
  let generation = 0, verificationPending = false;
  const assets = createThemeAssetUrls();
  return {
    invalidate(): void { generation++; verificationPending = true; assets.release(); },
    needsVerification(): boolean { return verificationPending; },
    async refresh(accept: (appearance: EffectiveThemeAppearance, assetUrls: Record<string, string>) => void): Promise<void> {
      const owner = ++generation;
      try {
        await waitForWrites();
        if (owner !== generation) return;
        const parsed = readEffectiveTheme(await read());
        if (!parsed) throw new Error("invalid effective theme response");
        const assetUrls = browserAssets ? await assets.materialize(parsed, () => owner === generation) : {};
        if (!assetUrls) return;
        if (owner !== generation) return;
        verificationPending = false;
        accept(parsed, assetUrls);
      } catch {
        if (owner !== generation) return;
        verificationPending = false;
        assets.release();
        accept({ ...CORE_THEME_APPEARANCE, fallbackReason: "invalid-state" }, {});
      }
    },
  };
}
