/** Narrow opened-library reads shared by local and approved remote Studio handlers. */
import { createThemeService, type ThemeReadService } from "./server-theme-extensions";
import type { PackagedAssets } from "./assets";
import type { LibraryHandle, OpenedLibrary } from "./library-root";

type ReadOnlyOpenedLibrary = {
  search: Pick<OpenedLibrary["search"], "search">;
  chats: Pick<OpenedLibrary["chats"], "castPortraitRef" | "getChat">;
  keyring: Pick<OpenedLibrary["keyring"], "leaseKeys">;
  isCurrent(): boolean;
};
export interface LibraryReadCapability {
  opened(): ReadOnlyOpenedLibrary | null;
  themeReader(): Promise<ThemeReadService | null>;
}

export function libraryReadCapability(library: LibraryHandle | undefined, packaged?: PackagedAssets): LibraryReadCapability | undefined {
  if (!library) return undefined;
  let themeOwner: OpenedLibrary | null = null;
  let themeService: Promise<ThemeReadService> | null = null;
  return { opened: () => {
    const opened = library.opened();
    return opened ? {
      keyring: { leaseKeys: () => opened.keyring.leaseKeys() }, search: opened.search, chats: opened.chats,
      isCurrent: () => library.opened() === opened,
    } : null;
  }, themeReader: async () => {
    const opened = library.opened();
    if (!opened?.stateStore) return null;
    if (themeOwner !== opened || !themeService) {
      themeOwner = opened;
      let pending: ReturnType<typeof createThemeService>;
      pending = createThemeService(opened.stateStore, packaged).catch((error) => {
        if (themeService === pending) themeService = null;
        throw error;
      });
      themeService = pending;
    }
    return themeService;
  } };
}
