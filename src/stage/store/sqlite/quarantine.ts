/** The SQLite stores quarantine only errors that mean persisted row data cannot be decoded. */
import { DamagedDataError } from "../../damaged-data-error";

export const isQuarantinableDecodeError = (error: unknown): boolean =>
  error instanceof DamagedDataError || error instanceof SyntaxError;
