/** Per-open-library thumbnail and staged-upload cleanup bound to actual key drops. */
import type { ContentStore } from "../stage/contracts/content-store";
import type { CellCipher } from "../stage/crypto/cell-cipher";
import type { createKeyring } from "../stage/crypto/keyring";
import { createAssetThumbnails } from "../stage/store/asset-thumbnails";
import { clearStagedAssets } from "./server-asset-staging";

export function createLibraryAssets(content: ContentStore, cipher: CellCipher, keyring: ReturnType<typeof createKeyring>) {
  const thumbnails = createAssetThumbnails({
    ready: () => { try { cipher.ready(); return true; } catch { return false; } },
    load: async (sha, maxBytes) => {
      const result = await content.readAsset(sha, maxBytes);
      if (result.status !== "ok") throw new Error(result.status === "too-large" ? "thumbnail input is too large" : "asset not found");
      return result.bytes;
    },
  });
  const unsubscribe = keyring.onDropKeys(() => { thumbnails.lock(); void clearStagedAssets(); });
  return { thumbnails, close() { void clearStagedAssets(); thumbnails.dispose(); unsubscribe(); } };
}
