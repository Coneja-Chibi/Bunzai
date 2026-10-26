/**
 * The shelves' CRUD menu section: Rename (in place, the piece's own name field), Duplicate
 * (keep-both save mints a sibling), Delete (danger, plain-words confirm). One hook owns the
 * whole flow so the Library only asks for it and reloads. Open pieces refuse rename/delete
 * (their editor could resurrect or clash on the next save); duplicate is always safe.
 */
import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { InkDialog } from "../../components/ink-dialog";
import { toErrorMessage } from "../../_shared/error-message";
import { isRecord } from "../../../core/guards";
import type { ParsedCanonicalEntity } from "../../../entities/runtime-schema";
import { buildPiecePatch } from "../../_shared/editor-patch";
import { plural } from "../../../core/text";
import { Button } from "../../components/button";

export interface EntityDelete {
  /** open the confirm sheet for this batch (empty batches are ignored) */
  requestDelete: (batch: StudioEntitySummary[]) => void;
  /** the confirm sheet + rename sheet, or null while nothing is pending */
  confirm: JSX.Element | null;
}


/** The piece's name lives on identity.name for characters, body.name for everything else. */
function withName(entity: Record<string, unknown>, name: string): Record<string, unknown> {
  const body = isRecord(entity.body) ? { ...entity.body } : {};
  if (entity.kind === "character") {
    body.identity = { ...(isRecord(body.identity) ? body.identity : {}), name };
  } else {
    body.name = name;
  }
  return { ...entity, body };
}

export function useEntityDelete(ctx: AppContext, onDeleted: () => void): EntityDelete {
  const [pending, setPending] = useState<StudioEntitySummary[] | null>(null);
  const [renaming, setRenaming] = useState<StudioEntitySummary | null>(null);
  const [renameText, setRenameText] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  const duplicate = async (e: StudioEntitySummary): Promise<void> => {
    try {
      if (e.kind === "pack") {
        // Packs hold pictures: the server copies them by reference, never opening the pack whole.
        await ctx.api.duplicateEntity(e.kind, e.id);
        onDeleted();
        ctx.setStatus(`duplicated ${e.name}`);
        return;
      }
      const entity = (await ctx.api.getEntity(
        `kind=${encodeURIComponent(e.kind)}&id=${encodeURIComponent(e.id)}`,
      )) as Record<string, unknown>;
      await ctx.api.saveEntity(entity); // keep-both mints the sibling id
      onDeleted();
      ctx.setStatus(`duplicated ${e.name}`);
    } catch (err) {
      ctx.setStatus(toErrorMessage(err, "could not duplicate"));
    }
  };

  const doRename = async (): Promise<void> => {
    const e = renaming;
    const name = renameText.trim();
    setRenaming(null);
    if (!e || !name || name === e.name) return;
    try {
      if (e.kind === "pack") {
        // Only the name changes, so only the head is sent: the pictures are never read back or rewritten.
        const light = await ctx.api.getLightEditableEntity(`kind=pack&id=${encodeURIComponent(e.id)}`);
        const before = light.entity as ParsedCanonicalEntity;
        const after = withName(before as unknown as Record<string, unknown>, name) as unknown as ParsedCanonicalEntity;
        await ctx.api.patchEditedEntity("pack", e.id, light.revision, buildPiecePatch(before, after));
        onDeleted();
        ctx.setStatus(`renamed to ${name}`);
        return;
      }
      const entity = (await ctx.api.getEntity(
        `kind=${encodeURIComponent(e.kind)}&id=${encodeURIComponent(e.id)}`,
      )) as Record<string, unknown>;
      await ctx.api.saveEntity(withName(entity, name), { overwrite: true });
      onDeleted();
      ctx.setStatus(`renamed to ${name}`);
    } catch (err) {
      ctx.setStatus(toErrorMessage(err, "could not rename"));
    }
  };

  useEffect(() => {
    return ctx.menus.register("entity", (t) => {
      const e = t.data as StudioEntitySummary;
      const open = ctx.workbench.pieces().some((p) => p.id === e.id && p.kind === e.kind);
      if (open) {
        return [
          { label: "Duplicate", onPick: () => void duplicate(e) },
          { label: "Close it on the Workbench to rename or delete", disabled: true, onPick: () => undefined },
        ];
      }
      return [
        {
          label: "Rename",
          onPick: () => {
            setRenameText(e.name);
            setRenaming(e);
          },
        },
        { label: "Duplicate", onPick: () => void duplicate(e) },
        { label: "Delete from the studio", danger: true, onPick: () => setPending([e]) },
      ];
    });
    // menu providers read live state through closures; register once per ctx
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx]);

  useEffect(() => {
    if (renaming) renameRef.current?.select();
  }, [renaming]);

  const doDelete = async (): Promise<void> => {
    const batch = pending ?? [];
    setPending(null);
    let removed = 0;
    let failed = 0;
    for (const e of batch) {
      try {
        await ctx.api.deleteEntity(e.kind, e.id);
        removed++;
      } catch {
        failed++;
      }
    }
    onDeleted();
    ctx.setStatus(
      failed === 0
        ? `deleted ${plural(removed, "piece")}`
        : `deleted ${removed}, could not delete ${failed}`,
    );
  };

  const confirm = pending ? (
    <InkDialog onDismiss={() => setPending(null)} ariaLabel="Delete pieces">
      <div className="delsheet">
        <b className="deltitle">
          {pending.length === 1
            ? `Move "${pending[0]!.name}" to Trash?`
            : `Move ${pending.length} pieces to Trash?`}
        </b>
        <p className="delbody">
          You can restore {pending.length === 1 ? "it" : "them"} from Trash for 3 days.{" "}
          {pending.length === 1 ? "It" : "They"} will no longer appear in your Library or selection menus while deleted.
        </p>
        <div className="delacts">
          <Button variant="danger" onClick={() => void doDelete()}>
            Delete
          </Button>
          <Button variant="quiet" onClick={() => setPending(null)}>
            Keep
          </Button>
        </div>
      </div>
    </InkDialog>
  ) : null;

  const renameSheet = renaming ? (
    <InkDialog onDismiss={() => setRenaming(null)} ariaLabel="Rename piece">
      <form
        className="delsheet"
        onSubmit={(ev) => {
          ev.preventDefault();
          void doRename();
        }}
      >
        <b className="deltitle">Rename &quot;{renaming.name}&quot;</b>
        <p className="delbody">The piece keeps everything else; only its name changes.</p>
        <input
          ref={renameRef}
          className="renamein"
          value={renameText}
          aria-label="New name"
          onChange={(ev) => setRenameText(ev.target.value)}
        />
        <div className="delacts">
          <Button variant="primary" type="submit">
            Rename
          </Button>
          <Button variant="quiet" onClick={() => setRenaming(null)}>
            Cancel
          </Button>
        </div>
      </form>
    </InkDialog>
  ) : null;

  const requestDelete = (batch: StudioEntitySummary[]): void => {
    if (batch.length > 0) setPending(batch);
  };
  return {
    requestDelete,
    confirm: (
      <>
        {confirm}
        {renameSheet}
      </>
    ),
  };
}
