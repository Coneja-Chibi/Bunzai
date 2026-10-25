/** Explicit partial entity envelope used only by light editor reads. */
export interface LightStoredEntity { entity: unknown; revision: string; version: number; writeId: number; assets: Record<string, string> }
/** Body and metadata captured from the same light read, without opening escrow or media bytes. */
export interface StoredBody { body: unknown; revision: string; version: number }
/** A selected slot (null when absent) paired with its owning piece's pinned metadata. */
export interface StoredOriginalEntry { entry: unknown | null; revision: string; version: number }
/** Risu's native asset tuples with opaque refs; projection never opens referenced blobs. */
export interface StoredRisuNamedAssets {
  items: { name: string; ref: string; ext: string; mime?: string }[];
  revision: string;
  version: number;
}
