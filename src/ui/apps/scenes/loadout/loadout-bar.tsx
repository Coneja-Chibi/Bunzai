/**
 * The Booth's loadout bar (RoleCall's QuickPlayPanel.tsx:1521-1533): the receipt banner, Change setup, and Save this scene as
 * a loadout. It owns its own open state and talks to the page only through `onSettings` (no window events, no storage:
 * RoleCall's open and undo are window events that do nothing when the host is not mounted). Apply and Undo run the engine in
 * this folder; what they write comes back as the page's new scene.
 */
import { useEffect, useRef, useState, type JSX } from "react";
import { LOADOUT_UNITS, type LoadoutUnit } from "../../../../core/loadout-panels";
import type { LoadoutRecord } from "../../../../studio/loadout-record";
import type { OpenScene } from "../../../../studio/scenes";
import type { AppContext } from "../../../app-contract";
import { Ic } from "../../../_shared/ic";
import { toErrorMessage } from "../../../_shared/error-message";
import { useVisibleInterval } from "../../../_shared/use-visible-interval";
import { LoadoutBanner } from "./loadout-banner";
import { patchScene } from "./loadout-patch";
import { runLoadout } from "./loadout-run";
import { LoadoutSaveDialog } from "./loadout-save-dialog";
import { LoadoutSwitcher } from "./loadout-switcher";
import { isOpen, newReceiptCode, undoNotice, type Notice } from "./loadout-text";
import { undoReceipt } from "./loadout-undo";
import { useSceneLoadouts } from "./use-scene-loadouts";

const APPLY_FAILED = "Could not apply this loadout. Your changes may be incomplete. Try again or review your current setup.";
const SAME = "Nothing to change. This scene already has this setup.";

export function LoadoutBar({ ctx, scene, busy, onSettings, now = Date.now, tickMs = 15_000 }: {
  ctx: AppContext;
  scene: OpenScene;
  busy: boolean;
  /** The scene after a write, and the units it wrote (lore and props answer no chat, so the page re-reads them). */
  onSettings(next: OpenScene, units: readonly LoadoutUnit[]): void;
  /** The clock, as epoch ms; tests own it. */
  now?: () => number;
  /** How often the banner re-reads the clock (RoleCall: 15 s). */
  tickMs?: number;
}): JSX.Element {
  const chatId = scene.chat.id;
  const { list, receipt, refresh } = useSceneLoadouts(ctx, chatId);
  const [open, setOpen] = useState<"switcher" | "save" | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [, tick] = useState(0);
  const held = useRef(scene);
  held.current = scene;
  // The undo window counts down only while a receipt is showing, and never in a hidden tab.
  useVisibleInterval(() => tick((n) => n + 1), receipt ? tickMs : null);
  useEffect(() => {
    if (saved === null) return;
    const timer = setTimeout(() => setSaved(null), 2000);
    return () => clearTimeout(timer);
  }, [saved]);

  const hand = (patch: Partial<Record<LoadoutUnit, unknown>>, order: readonly LoadoutUnit[]): void => {
    const units = order.filter((u) => patch[u] !== undefined);
    if (units.length > 0) onSettings(patchScene(held.current, patch, order), units);
  };
  const apply = async (loadout: LoadoutRecord): Promise<string | null> => {
    setNotice(null);
    try {
      const run = await runLoadout({ api: ctx.api, chatId, loadout, now: now(), newCode: newReceiptCode, busy });
      hand(run.patch, LOADOUT_UNITS);
      await refresh();
      if (run.status === "nothing-to-change") return SAME;
      if (run.status === "busy") return "Wait for the reply to finish, then apply.";
      return run.status === "not-saved" ? run.error ?? APPLY_FAILED : null;
    } catch {
      return APPLY_FAILED;
    }
  };
  const undo = async (): Promise<void> => {
    if (!receipt || undoing) return;
    setUndoing(true);
    try {
      const result = await undoReceipt({ api: ctx.api, receipt, openChatId: chatId, now: now(), busy });
      hand(result.patch, [...LOADOUT_UNITS].reverse());
      setNotice(undoNotice(result));
      await refresh();
    } catch (e) {
      setNotice({ tone: "error", text: toErrorMessage(e, "Could not undo this loadout.") });
    }
    setUndoing(false);
  };

  const t = now();
  return (
    <section className="ldb" data-part="scene.booth.loadouts" aria-label="Loadouts">
      {receipt && isOpen(receipt, t) && <LoadoutBanner receipt={receipt} now={t} working={undoing} busy={busy} onUndo={() => void undo()} />}
      {notice && <p className={`bth-note${notice.tone === "ok" ? "" : " warn"}`} role={notice.tone === "error" ? "alert" : "status"}>{notice.text}</p>}
      <div className="ldb-acts">
        <button type="button" className="ldb-btn" onClick={() => { setOpen("switcher"); void refresh(); }}><Ic name="lucide:bookmark" size={14} />Change setup</button>
        <button type="button" className="ldb-btn" onClick={() => setOpen("save")}><Ic name="lucide:bookmark" size={14} />Save this scene as a loadout</button>
        {saved !== null && <span className="ldb-chip" role="status"><Ic name="lucide:check" size={14} />Saved "{saved}"</span>}
      </div>
      {open === "switcher" && (
        <LoadoutSwitcher ctx={ctx} chatId={chatId} list={list} active={receipt && isOpen(receipt, t) ? receipt : null} busy={busy} onApply={apply}
          onSaveCurrent={() => setOpen("save")} onRetry={() => void refresh()} onClose={() => setOpen(null)} />
      )}
      {open === "save" && (
        <LoadoutSaveDialog ctx={ctx} chatId={chatId} loadouts={list.state === "ready" ? list.loadouts : []}
          onSaved={(name) => { setOpen(null); setSaved(name); void refresh(); }} onClose={() => setOpen(null)} />
      )}
    </section>
  );
}
