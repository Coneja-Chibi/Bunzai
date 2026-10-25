/** Revision-fenced Risu NamedAsset projection, edits, and staged-grant provenance. */
import { useCallback, useEffect, useRef, useState } from "react";
import { kindFromExt, newNamedId, normalizeNamed, type NamedAssetsValue } from "../../../core/media";
import type { AppContext } from "../../app-contract";
import type { StagedAssetUpload } from "../../app-contract-editor";
import { rowsOfNamed, type NamedAssetRow } from "./character-patch-save";

type ReadState = "loading" | "available" | "unavailable";

export function useCharacterNamedAssets(api: AppContext["api"], id: string, revision: { current: string }, version?: number) {
  const [projection, setProjection] = useState<NamedAssetsValue | null>(null);
  const [readState, setReadState] = useState<ReadState>("loading");
  const uploads = useRef<StagedAssetUpload[]>([]);
  const baselineRows = useRef<NamedAssetRow[]>([]);
  const editGeneration = useRef(0);
  const initialRevision = useRef(revision.current);
  const load = useCallback(async (): Promise<boolean> => {
    const acceptedGeneration = editGeneration.current;
    setReadState("loading");
    for (let attempt = 0; attempt < 3; attempt++) {
      const expected = revision.current;
      try {
        const result = await api.getRisuNamedAssets("character", id);
        if (editGeneration.current !== acceptedGeneration) return false;
        if (!result || result.revision !== expected || (version !== undefined && expected === initialRevision.current && result.version !== version) || revision.current !== expected) continue;
        const value = normalizeNamed({ items: result.items.map((item) => ({
          id: newNamedId(), name: item.name, ref: item.ref, ext: item.ext, kind: kindFromExt(item.ext),
          ...(item.mime ? { mime: item.mime } : {}),
        })) });
        baselineRows.current = rowsOfNamed(value);
        setProjection(value);
        setReadState("available");
        return true;
      } catch {
        break;
      }
    }
    if (editGeneration.current === acceptedGeneration) setReadState("unavailable");
    return false;
  }, [api, id, revision, version]);
  useEffect(() => { void load(); }, [load]);

  const apply = useCallback((value: NamedAssetsValue, staged: StagedAssetUpload[]) => {
    editGeneration.current++;
    const refs = new Set(value.items.map((item) => item.ref));
    const used = staged.filter((grant) => refs.has(grant.asset));
    const usedRefs = new Set(used.map((grant) => grant.ref));
    const unused = staged.filter((grant) => !usedRefs.has(grant.ref));
    uploads.current = [...new Map([...uploads.current, ...used].map((grant) => [grant.ref, grant])).values()];
    setProjection(value);
    return unused.map((grant) => grant.ref);
  }, []);

  const accept = useCallback((rows: NamedAssetRow[], remaining: StagedAssetUpload[], captured: readonly StagedAssetUpload[], generation: number) => {
    baselineRows.current = rows;
    const keep = new Set(remaining.map((grant) => grant.ref));
    const capturedRefs = new Set(captured.map((grant) => grant.ref));
    uploads.current = uploads.current.filter((grant) => !capturedRefs.has(grant.ref) || keep.has(grant.ref));
    if (editGeneration.current === generation) {
      const value = normalizeNamed({ items: rows.map(([name, ref, ext]) => ({
        id: newNamedId(), name, ref, ext, kind: kindFromExt(ext),
      })) });
      setProjection(value);
    }
  }, []);
  const noteEdit = useCallback(() => { editGeneration.current++; }, []);

  return { projection, readState, load, uploads, baselineRows, editGeneration, apply, accept, noteEdit };
}
