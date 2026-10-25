/**
 * Container ceilings for .lvbak archives.
 * A .lvbak is a whole-library backup, so it uses core's shared backup profile; the numbers and why
 * live there.
 */
import { BACKUP_ARCHIVE_BOUNDS, type UnzipBounds } from "../../core/archive";

export const LVBAK_ARCHIVE_BOUNDS: UnzipBounds = BACKUP_ARCHIVE_BOUNDS;
