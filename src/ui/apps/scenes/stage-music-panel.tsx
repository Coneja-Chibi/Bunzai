/**
 * The Stage wing's Music tab: RoleCall's MoodMusicWingPanel (MoodMusicWingPanel.tsx:182-433) over the person's own packs. Top to bottom as
 * RoleCall draws it: the now-playing block with Play or Pause, Next, Stop and the volume; the add form ("Add Personal Track" there, the
 * same words here); then every track, grouped by pack where RoleCall groups by category, each row with its pencil and trash. The tab
 * carries no title of its own (the foldout strip names it), and RoleCall's Story Director line, Suno link, tags and notes are not here.
 */
import { useRef, useState, type JSX } from "react";
import type { AppContext } from "../../app-contract";
import { Ic } from "../../_shared/ic";
import { Slider } from "../../components/slider";
import { SegControl } from "../settings/section-contract";
import { toErrorMessage } from "../../_shared/error-message";
import { addLinkToPack, addToPack } from "./scene-backdrop-add";
import { removeTrack, renameTrack } from "./stage-music-edit";
import type { Track } from "./stage-music-core";
import type { MusicPlayer } from "./stage-music-player";
import { failureWords, soundFile } from "./stage-music-form";
import { useMusicLibrary } from "./use-music-library";
import { sharedMusic, useStageMusic } from "./use-stage-music";
import { ListRow, IconButton, Button } from "../../components/button";

export function MusicPanel({ ctx, player = sharedMusic }: { ctx: AppContext; player?: MusicPlayer }): JSX.Element {
  const { state, setVolume } = useStageMusic(ctx, player);
  const library = useMusicLibrary(ctx);
  const [pick, setPick] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("");
  const [editing, setEditing] = useState<Track | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const files = useRef<HTMLInputElement>(null);

  const target = pick && library.packs.some((p) => p.id === pick) ? pick : (library.groups[0]?.packId ?? library.packs[0]?.id ?? null);
  const total = library.groups.reduce((n, g) => n + g.tracks.length, 0);
  const { track } = state;

  const reset = (): void => { setLink(""); setTitle(""); setEditing(null); setFormError(null); };
  const run = async (work: () => Promise<string | null>): Promise<void> => {
    setBusy(true);
    setFormError(null);
    try {
      const problem = await work();
      if (problem) setFormError(problem); else reset();
    } catch (e) {
      setFormError(failureWords(toErrorMessage(e, "")));
    } finally {
      library.reload();
      setBusy(false);
    }
  };
  const report = (r: { added: number; failed: string[] }, reason?: string): string | null =>
    r.failed.length > 0 ? (reason ?? `Could not add ${r.failed.join(", ")}.`) : null;

  const addLink = (): Promise<void> => run(async () => {
    if (!link.trim()) return "Paste a direct audio link, or choose files.";
    if (!target) return "Make a pack in the Library first.";
    const r = await addLinkToPack(ctx, target, link, title);
    return report(r, r.reason ?? "Could not add that link.");
  });
  const addFiles = (list: FileList | null): Promise<void> => run(async () => {
    const picked = [...(list ?? [])].filter(soundFile);
    if (picked.length === 0 || !target) return list && list.length > 0 ? "Those are not sound files." : null;
    return report(await addToPack(ctx, target, picked.map((file) => ({ name: file.name, stage: () => ctx.api.uploadAsset(file) }))));
  });
  const save = (): Promise<void> => run(async () => {
    if (!editing) return null;
    if (!title.trim()) return "Give the track a title.";
    await renameTrack(ctx, editing.packId, editing.itemId, title);
    return null;
  });
  const remove = (t: Track): Promise<void> => run(async () => {
    await removeTrack(ctx, t.packId, t.itemId);
    if (track?.id === t.id) player.stop();
    if (editing?.id === t.id) setEditing(null);
    return null;
  });
  const beginEdit = (t: Track): void => { setEditing(t); setTitle(t.title); setLink(""); setFormError(null); };

  return (
    <div className="mm" data-part="scene.stage.music">
      <div className="mm-now">
        <div className="mm-row">
          <div className="mm-tile"><Ic name="lucide:volume-2" size={20} /></div>
          <div className="mm-text">
            <p className="mm-title">{track?.title ?? "No track selected"}</p>
            <p className="mm-sub">{track?.packName ?? "Pick a track below."}</p>
            {state.error && <p className="mm-err">{state.error}</p>}
          </div>
        </div>
        <div className="mm-bar">
          <IconButton icon={state.playing ? "lucide:pause" : "lucide:play"} label={state.playing ? "Pause mood music" : "Play mood music"} disabled={!track} onClick={() => player.toggle()} />
          <IconButton icon="lucide:skip-forward" label="Next mood music track" disabled={!track} onClick={() => player.next()} />
          <IconButton icon="lucide:square" label="Stop mood music" disabled={!track} onClick={() => player.stop()} />
          <label className="mm-vol"><Ic name="lucide:volume-2" size={16} />
            <Slider value={state.volume} min={0} max={1} step={0.01} onChange={setVolume} format={(v) => `${String(Math.round(v * 100))}%`} aria-label="Mood music volume" />
          </label>
        </div>
      </div>

      <div className="mm-add">
        <p className="mm-head">{editing ? "Edit Personal Track" : "Add Personal Track"}</p>
        {!editing && library.packs.length > 1 && target && (
          <SegControl options={library.packs.map((p) => ({ value: p.id, label: p.name || "Untitled pack" }))} current={target} onPick={setPick} />
        )}
        {!editing && <input type="url" className="mm-in" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Direct audio link (https)" aria-label="Direct audio link" onKeyDown={(e) => { if (e.key === "Enter") void addLink(); }} />}
        <input type="text" className="mm-in" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" aria-label="Title" onKeyDown={(e) => { if (e.key === "Enter" && editing) void save(); }} />
        {formError && <p className="mm-err">{formError}</p>}
        {library.state === "ready" && library.packs.length === 0 && <p className="mm-hint">Tracks live in a pack. Make a pack in the Library, then come back and add sound files to it.</p>}
        <div className="mm-actions">
          <Button variant="primary" icon={busy ? "lucide:loader-circle" : editing ? "lucide:save" : "lucide:plus"} disabled={busy || (!editing && !target)} onClick={() => void (editing ? save() : addLink())}>
            {editing ? "Save" : "Add"}
          </Button>
          {!editing && <Button disabled={busy || !target} onClick={() => files.current?.click()}>Choose files</Button>}
          {editing && <Button variant="quiet" disabled={busy} onClick={reset}>Cancel</Button>}
          <input ref={files} type="file" multiple hidden accept="audio/*,.mp3,.ogg,.m4a,.wav,.flac,.aac" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
        </div>
      </div>

      <div className="mm-lib">
        {library.state === "ready" && total === 0 && <p className="mm-hint">No sound files yet. Add some above, and they appear here.</p>}
        {library.groups.map((g) => (
          <section key={g.packId} className="mm-cat">
            <div className="mm-cat-hd"><h3>{g.name}</h3><span>{g.tracks.length}</span></div>
            <div className="mm-list">
              {g.tracks.map((t) => (
                <div key={t.id} className={`mm-item${track?.id === t.id ? " on" : ""}`}>
                  <ListRow onClick={() => void player.play(t, g.tracks)} label={t.title} />
                  <IconButton variant="quiet" size="sm" icon="lucide:pencil" label={`Edit ${t.title}`} onClick={() => beginEdit(t)} />
                  <IconButton variant="danger" size="sm" icon="lucide:trash-2" label={`Delete ${t.title}`} disabled={busy} onClick={() => void remove(t)} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
