/** Reading one library piece's current body by kind and id, the way every scene reader does: the store's body-only read when it has one, else the whole piece. A trashed or missing piece is null. */
import type { StudioStoreLike } from "./contracts";

export type BodyStore = Pick<StudioStoreLike, "read"> & Partial<Pick<StudioStoreLike, "readBody">>;

export function bodyReader<B>(store: BodyStore, kind: string): (id: string) => Promise<B | null> {
  return async (id) => {
    if (store.readBody) return (await store.readBody(kind, id)) as B | null;
    const entity = await store.read(kind, id);
    return entity?.kind === kind ? (entity.body as B) : null;
  };
}
