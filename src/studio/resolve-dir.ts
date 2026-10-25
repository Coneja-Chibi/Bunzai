/**
 * The default studio folder. Bunraku keeps its own home, "Bunraku Studio", and never adopts or
 * moves a folder belonging to another app: a Hoplight or Vaude studio on the same machine stays
 * where it is, and its contents arrive in Bunraku only through the explicit folder import
 * (D5). The folder store itself is transitional; phase 1 moves the library into
 * the database and this resolver then names the database's parent folder.
 */
import { join } from "node:path";

export function resolveDefaultStudioDir(homeDir: string): string {
  return join(homeDir, "Documents", "Bunraku Studio");
}
