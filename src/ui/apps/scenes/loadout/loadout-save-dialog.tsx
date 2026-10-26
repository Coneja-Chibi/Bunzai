/**
 * The save dialog (RoleCall's LoadoutSaveButton.tsx:395-560): a name, New loadout or Update existing, and "What to include",
 * the ten live panels in RoleCall's groups with All current / Writing only / None. The scene is read when the dialog opens
 * (to tick what it holds) and again when saving, so what is saved is the scene as it is then. Update replaces the chosen
 * loadout, so it opens ticked with that loadout's own panels (RoleCall starts from the scene and silently drops the rest).
 */
import { useEffect, useState, type JSX } from "react";
import { LOADOUT_NAME_MAX, PANEL_META } from "../../../../core/loadout-panels";
import type { LoadoutRecord } from "../../../../studio/loadout-record";
import type { AppContext } from "../../../app-contract";
import type { SceneSettings } from "../../../app-contract-scenes";
import { Button, IconButton, Segmented } from "../../../components/button";
import { InkDialog } from "../../../components/ink-dialog";
import { toErrorMessage } from "../../../_shared/error-message";
import { captureLoadout } from "./loadout-capture";
import { LIVE_PANELS, allPanels, defaultTicks, panelSummary, writingOnly } from "./loadout-save-core";

const TITLE = "Save this scene as a loadout";

export function LoadoutSaveDialog({ ctx, chatId, loadouts, onSaved, onClose }: {
  ctx: AppContext;
  chatId: string;
  loadouts: readonly LoadoutRecord[];
  onSaved(name: string): void;
  onClose(): void;
}): JSX.Element {
  const [live, setLive] = useState<SceneSettings | null>(null);
  const [mode, setMode] = useState<"new" | "update">("new");
  const [name, setName] = useState("My Loadout");
  const [target, setTarget] = useState("");
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let current = true;
    ctx.api.sceneSettings(chatId).then((s) => { if (current) { setLive(s); setTicked(defaultTicks(s)); } }, (e: unknown) => { if (current) setError(toErrorMessage(e, "this scene's settings could not be read")); });
    return () => { current = false; };
  }, [ctx, chatId]);

  const pick = (id: string): void => {
    setTarget(id);
    const found = loadouts.find((l) => l.id === id);
    if (found) setTicked(new Set(found.panels.filter((p) => Object.hasOwn(PANEL_META, p) && PANEL_META[p as keyof typeof PANEL_META].status === "mapped")));
  };
  const save = async (): Promise<void> => {
    const existing = loadouts.find((l) => l.id === target);
    if (saving || (mode === "update" ? !existing : !name.trim())) return;
    setSaving(true);
    setError(null);
    try {
      const values = captureLoadout(await ctx.api.sceneSettings(chatId), ticked);
      const saved = await ctx.api.saveLoadout(mode === "update" ? { id: existing!.id, name: existing!.name, values } : { name: name.trim(), values });
      onSaved(saved.name);
    } catch (e) {
      setError(toErrorMessage(e, "Failed to save loadout"));
      setSaving(false);
    }
  };
  const flip = (id: string, on: boolean): void => setTicked((t) => { const n = new Set(t); if (on) n.add(id); else n.delete(id); return n; });
  const shortcut = (label: string, next: () => Set<string>): JSX.Element => <Button variant="quiet" size="sm" onClick={() => setTicked(next())}>{label}</Button>;

  return (
    <InkDialog ariaLabel={TITLE} onDismiss={onClose} sheetClassName="ldd-sheet">
      <div className="ldd">
        <header><h2>{TITLE}</h2><IconButton label="Close save loadout dialog" icon="lucide:x" onClick={onClose} /></header>
        <p className="ldd-note">This saves reusable settings only. Messages, takes, and variables stay out.</p>
        <div className="ldd-lbl">Save action</div>
        <Segmented label="Save action" items={[{ value: "new", label: "New loadout" }, { value: "update", label: "Update existing", disabled: loadouts.length === 0 }]} value={mode} onChange={setMode} />
        <label className="ldd-lbl" htmlFor="ldd-name">{mode === "new" ? "Name" : "Loadout to update"}</label>
        {mode === "update" ? (
          <select id="ldd-name" aria-label="Loadout to update" value={target} onChange={(e) => pick(e.target.value)}>
            <option value="">Choose a loadout</option>
            {loadouts.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        ) : (
          <input id="ldd-name" aria-label="Name" type="text" value={name} placeholder="My Loadout" maxLength={LOADOUT_NAME_MAX} autoFocus
            onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void save(); } }} />
        )}
        <p className="ldd-note">Configure features in their normal wings. This only chooses which current values the loadout remembers.</p>
        <div className="ldd-head">
          <span>What to include · {ticked.size} of {LIVE_PANELS.reduce((n, g) => n + g.panels.length, 0)}</span>
          <span className="ldd-short">{shortcut("All current", allPanels)} · {shortcut("Writing only", writingOnly)} · {shortcut("None", () => new Set())}</span>
        </div>
        <div className="ldd-list">
          {live && LIVE_PANELS.map((g) => (
            <div key={g.id}>
              <div className="ldd-grp">{g.label}</div>
              {g.panels.map((id) => (
                <label key={id} className="ldb-row">
                  <input type="checkbox" checked={ticked.has(id)} onChange={(e) => flip(id, e.target.checked)} />
                  <span className="pn"><span>{PANEL_META[id].label}</span><small>{defaultTicks(live).has(id) ? "Captures this scene's current value" : "Not set on this scene"}</small></span>
                  <span className="ldd-sum">{panelSummary(id, live)}</span>
                </label>
              ))}
            </div>
          ))}
          <p className="ldd-note">More settings will join this list as their wings arrive.</p>
        </div>
        {error && <p className="ldd-err" role="alert">{error}</p>}
        <footer>
          <Button variant="quiet" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={saving || (mode === "new" ? !name.trim() : !target)} onClick={() => void save()}>{mode === "update" ? "Update selected loadout" : "Save selected settings"}</Button>
        </footer>
      </div>
    </InkDialog>
  );
}
