/** Shared answer to "does this host keep an Export folder?" for the Press and the export dialog. */
import { apiStatusIs } from "./api-fetch";

/** True when this host keeps no Export folder (a remote device is refused: 403; the browser edition has no disk: 501), so the caller downloads. */
export const noExportFolder = (e: unknown): boolean => apiStatusIs(e, 403) || apiStatusIs(e, 501);
