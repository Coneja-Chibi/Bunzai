/**
 * The Branching Tree (RoleCall app/scenes/branching-tree page.tsx, "Full conversation timeline with all branches"): every take of one
 * scene as a nested list, a click opens that take, the pencil renames it, the trash sends it to the Trash. RoleCall deletes for good
 * after a browser confirm; here a delete is the store's soft delete (ChatStore rule 12), so the page offers Restore at once and
 * the Trash keeps it for 3 days. Everything goes through the scene's own change route, so the tree is a second view of the takes
 * the pill menu already manages, never a second store.
 */
import { useCallback, useEffect, useState, type JSX } from "react";
import type { AppContext } from "../../app-contract";
import { Ic } from "../../_shared/ic";
import { protect } from "../../_shared/protected-control";
import { isEscapeClose } from "../../_shared/use-escape-key";
import { toErrorMessage } from "../../_shared/error-message";
import type { OpenScene, SceneAction, TakeSummary } from "../../../studio/scenes";
import { DeleteTakeDialog } from "./scene-takes";
import { TakeCompare } from "./scene-tree-compare";
import { takeLabel, takeMeta, takeTree, type TreeNode } from "./scene-tree-core";
import { Button, IconButton, ListRow } from "../../components/button";

export function BranchTree({ ctx, chatId, onBack, onOpen }: { ctx: AppContext; chatId: string; onBack(): void; onOpen(): void }): JSX.Element {
  const { api } = ctx;
  const [scene, setScene] = useState<OpenScene | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [ask, setAsk] = useState<TakeSummary | null>(null);
  const [trashed, setTrashed] = useState<TakeSummary | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [pair, setPair] = useState<{ a: string; b: string } | null>(null);

  const load = useCallback(() => {
    setProblem(null);
    api.openScene(chatId).then(setScene, (e: unknown) => setProblem(toErrorMessage(e, "The branching tree could not load.")));
  }, [api, chatId]);
  useEffect(load, [load]);

  const act = async (action: SceneAction, input: Record<string, unknown>, id: string): Promise<OpenScene | null> => {
    if (busy) return null;
    setBusy(id);
    try {
      const next = await api.editScene(action, { chatId, ...input });
      setScene(next);
      return next;
    } catch (e) {
      setProblem(toErrorMessage(e, "That change could not be made."));
      load();
      return null;
    } finally {
      setBusy(null);
    }
  };
  const open = async (take: TakeSummary): Promise<void> => {
    if (editing || (take.id !== scene?.chat.activeBranchId && !(await act("take", { branchId: take.id }, take.id)))) return;
    onOpen();
  };
  const rename = async (): Promise<void> => {
    const name = editing?.name.trim() ?? "";
    const current = scene?.takes.find((t) => t.id === editing?.id);
    const target = editing;
    setEditing(null);
    if (target && name && name !== current?.name) await act("rename-take", { branchId: target.id, name }, target.id);
  };
  const remove = async (take: TakeSummary): Promise<void> => {
    setAsk(null);
    if (await act("delete-take", { branchId: take.id }, take.id)) setTrashed(take);
  };
  const restore = async (): Promise<void> => {
    const take = trashed;
    if (!take) return;
    setTrashed(null);
    try {
      await api.restoreSceneGrave("take", take.id);
    } catch (e) {
      setProblem(toErrorMessage(e, "The take could not be restored."));
    }
    load();
  };

  const compare = (id: string): void => {
    if (pick === null) setPick(id);
    else if (pick === id) setPick(null);
    else setPair({ a: pick, b: id });
  };
  const node = (n: TreeNode): JSX.Element => {
    const t = n.take;
    const main = t.parentBranchId === null;
    const here = t.id === scene?.chat.activeBranchId;
    return (
      <div key={t.id}>
        <div className={`row${main ? " main" : ""}${here ? " cur" : ""}`} style={{ marginLeft: n.depth * 40 }}>
          <span className="ic"><Ic name={main ? "lucide:clapperboard" : "lucide:git-branch"} size={16} /></span>
          {editing?.id === t.id ? (
            <input className="rename" autoFocus aria-label="Take name" maxLength={80} value={editing.name} onChange={(e) => setEditing({ id: t.id, name: e.target.value })} onBlur={() => void rename()}
              onKeyDown={(e) => {
                if (e.key === "Enter") void rename();
                else if (isEscapeClose(e.nativeEvent)) { e.stopPropagation(); setEditing(null); }
              }} />
          ) : (
            <ListRow disabled={busy === t.id} onClick={() => void open(t)}
              label={<><b>{takeLabel(t)}</b>{main && <span className="chip">Main</span>}{here && <span className="chip here">Viewing</span>}</>} subtitle={takeMeta(t)} />
          )}
          {editing?.id !== t.id && <IconButton variant={pick === t.id ? "primary" : "quiet"} size="sm" icon="lucide:columns-2" title="Compare takes" label={`Compare ${t.name}`} aria-pressed={pick === t.id} onClick={() => compare(t.id)} />}
          {!main && editing?.id !== t.id && (
            <>
              <IconButton variant="quiet" size="sm" icon="lucide:pencil" title="Rename" label={`Rename ${t.name}`} onClick={() => setEditing({ id: t.id, name: t.name })} />
              <span {...protect("take-delete")}><IconButton variant="danger" size="sm" icon="lucide:trash-2" title="Delete take" label={`Delete ${t.name}`} disabled={busy === t.id} onClick={(e) => { if (e.shiftKey) void remove(t); else setAsk(t); }} /></span>
            </>
          )}
          <span className="go"><Ic name="lucide:chevron-right" size={16} /></span>
        </div>
        {n.children.length > 0 && <div className="kids">{n.children.map(node)}</div>}
      </div>
    );
  };

  const tree = scene ? takeTree(scene.takes) : null;
  return (
    <div className="sct" data-part="scene.tree">
      <div className="pg">
        <div className="hd">
          <Button variant="quiet" icon="lucide:arrow-left" onClick={onBack}>Back to Scene</Button>
          <div className="ttl">
            <span className="tile"><Ic name="lucide:git-branch" size={20} /></span>
            <div><h1>Branching Tree</h1><p className="sub">Full conversation timeline with all branches</p></div>
          </div>
        </div>
        {problem && <div className="note" role="alert">{problem}</div>}
        {pick !== null && <div className="note" role="status">Comparing {scene?.takes.find((t) => t.id === pick)?.name ?? "a take"}. Pick another take.</div>}
        {trashed && (
          <div className="note" role="status">
            <span>{trashed.name} is in the Trash for 3 days.</span>
            <span {...protect("take-delete")}><Button onClick={() => void restore()}>Restore</Button></span>
          </div>
        )}
        {!scene && !problem && <div className="empty">Loading branching tree...</div>}
        {scene && (tree ? <div className="list">{node(tree)}</div> : <div className="empty">No branches found</div>)}
      </div>
      {pair && <TakeCompare api={api} chatId={chatId} a={pair.a} b={pair.b} onClose={() => { setPair(null); setPick(null); }} />}
      {ask && <DeleteTakeDialog take={ask} onCancel={() => setAsk(null)} onConfirm={() => void remove(ask)} />}
    </div>
  );
}
