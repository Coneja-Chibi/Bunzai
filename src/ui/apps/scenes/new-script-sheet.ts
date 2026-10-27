/** Saving a new Script Sheet from the Prompting wing: the first save creates the piece, every later save updates that same piece, as RoleCall keeps the id once a sheet is saved. */
import type { AppContext } from "../../app-contract";
import type { ScriptSheetBody } from "../../../entities/scriptsheet/schema";
import { createAndOpenPiece } from "../../_shared/new-piece";
import type { SheetDraft } from "../../_shared/script-sheet-editor";

export function newSheetSaver(ctx: Pick<AppContext, "api">): { id(): string | null; save(draft: SheetDraft): Promise<void> } {
  let id: string | null = null;
  return {
    id: () => id,
    async save({ name, content }) {
      if (!id) {
        id = (await createAndOpenPiece(ctx as AppContext, "scriptsheet", "script-sheet", { name, content } satisfies ScriptSheetBody)).id;
        return;
      }
      const found = await ctx.api.getEditableEntity(`kind=scriptsheet&id=${encodeURIComponent(id)}`);
      const entity = found.entity as { body: ScriptSheetBody };
      await ctx.api.saveEditedEntity({ ...entity, body: { ...entity.body, name, content } }, found.revision);
    },
  };
}
