/** Send-only-changed editor patch contract shared by ContentStore and its HTTP adapter. */
export interface PiecePatch {
  head: unknown;
  items?: Record<string, unknown>;
  order?: readonly string[];
  original?: Record<string, unknown>;
  /** These operations own only their named authored paths; generic raw edits may still update other fields. */
  native?: {
    /** Complete parent-edge snapshot, submitted only when folder nesting changed. */
    marinaraFolderParents?: readonly { id: string; parentFolderId: string | null }[];
    /** Risu additionalAssets rows; references are authorized by the same blob/grant set as body refs. */
    risuAdditionalAssets?: readonly (readonly [name: string, ref: string, ext: string])[];
  };
}
