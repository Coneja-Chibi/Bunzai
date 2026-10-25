/**
 * THE size and count limits for media, each with the reason it exists. The library is the person's own local
 * copy, so none of these is policy: every one is here because something still loads the whole payload into
 * memory. Lift one when the path that needs it streams, and delete the constant with it. A picture has its own
 * limit in image-limit.ts (`IMAGE_MAX_BYTES`); a limit that is not repeated lives beside the one thing it bounds.
 */
import { ADAPTER_INPUT_MAX_BYTES } from "../adapter-input";

/**
 * Most one asset (video, audio, font, or a stored picture being served) may weigh. An upload is buffered whole to be
 * sniffed and sealed, and the asset route, the thumbnailer, the portrait read and the browser cache each read
 * the whole asset to answer one request. Pictures held to the smaller `IMAGE_MAX_BYTES` when they are added.
 */
export const ASSET_MAX_BYTES = 32 * 1024 * 1024;

/** Most assets one staged batch holds. Staged bytes wait in memory until a save seals them, so the batch is a handful. */
export const ASSET_BATCH_COUNT = 8;

/** Most a staged batch may weigh in all, for the same reason as `ASSET_BATCH_COUNT`: staged bytes are held in memory. */
export const ASSET_BATCH_BYTES = 128 * 1024 * 1024;

/**
 * Most a JSON request body may weigh. It is read whole and parsed whole, and a turn or an import can carry a picture
 * as base64, which is a third larger than the picture's own limit.
 */
export const JSON_BODY_MAX_BYTES = 32 * 1024 * 1024;

/**
 * IMPORT ONLY, and temporary. Most a pack zip may weigh when it is read in: importing reads the whole zip into memory
 * (the same whole-file ceiling every import door has). Printing a pack streams a picture at a time and has NO archive
 * cap; a path that streams never gains a cap to match one that does not. This goes away when the pack zip import
 * streams (the next streaming slice).
 */
export const PACK_ZIP_MAX_BYTES = ADAPTER_INPUT_MAX_BYTES;

/** IMPORT ONLY, and temporary like `PACK_ZIP_MAX_BYTES`: the importer lists every entry and stages them in batches. */
export const PACK_ZIP_MAX_ENTRIES = 256;
