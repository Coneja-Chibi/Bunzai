/** Authenticated desktop Studio read routes delegate to the runtime-neutral projection owner. */
import type { StudioStoreLike } from "../studio/contracts";
import { handleStudioRead as readRoute } from "./_shared/studio-read-route";
import { json, studioErr } from "./server-security";

export function handleStudioRead(path: string, url: URL, store: StudioStoreLike): Promise<Response | null> {
  return readRoute(path, url, store, json, studioErr);
}
