/** Bounded opaque asset reads and the targeted portrait reference pinned to a piece version. */
export type AssetLookup =
  | { status: "missing" | "too-large" }
  | { status: "ok"; bytes: Uint8Array };

export type AssetSize = { status: "missing" } | { status: "ok"; bytes: number };

export type PortraitAssetReference =
  | { sha: string; mime: string }
  | { url: string; mime: string; bytes?: number };

export interface StoredPortraitAsset {
  kind: string;
  id: string;
  asset: PortraitAssetReference;
  revision: string;
  version: number;
  writeId: number;
}

/** Legacy binary compatibility read; selected without assembling escrow or unrelated part payloads. */
export interface StoredPortraitContent {
  bytes: Uint8Array;
  mime: string;
  sha: string;
  revision: string;
  version: number;
  writeId: number;
}
