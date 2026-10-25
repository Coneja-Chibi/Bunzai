/**
 * The one interim size limit for a single picture. Pictures are still read whole in places (a staged upload is
 * sniffed and sealed, a pack picture is read for its turn in the archive), so the cap is the same everywhere:
 * upload, link, paste, Kit attachment and pack print. It is a limit to lift as those paths stop loading whole
 * pictures, not a design rule. Video and audio keep the larger media cap (`ASSET_MAX_BYTES`, limits.ts).
 */
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/** The limit in the words a person reads ("10 MB"). */
export const imageLimitLabel = (): string => `${String(IMAGE_MAX_BYTES / 1024 / 1024)} MB`;
