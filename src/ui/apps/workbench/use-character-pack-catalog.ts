/** Loads the light character/pack picker rows only while SpritePackDialog is open. */
import { useEffect, useState } from "react";
import type { AppContext } from "../../app-contract";

export function useCharacterPackCatalog(api: AppContext["api"], characterId: string, open: boolean): { id: string; name: string }[] {
  const [rows, setRows] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!open) return;
    let live = true;
    void Promise.all([api.listEntities("character"), api.listEntities("pack")]).then(([characters, packs]) => {
      if (!live) return;
      const next = [
        ...packs.map((item) => ({ id: `pack:${item.id}`, name: `Pack · ${item.name || item.id}` })),
        ...characters.filter((item) => item.id !== characterId).map((item) => ({ id: `character:${item.id}`, name: `Char · ${item.name || item.id}` })),
      ];
      next.sort((a, b) => a.name.localeCompare(b.name));
      setRows(next);
    }).catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [api, characterId, open]);
  return rows;
}
