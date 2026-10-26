/**
 * The Control Booth's character navigator (RoleCall's ChatCharacterNavigator, quick-play card variant,
 * ChatCharacterNavigator.tsx:316-376 and the "new" route): the scene's character with a tagline and up to
 * three traits, and Change Character, which opens the Character Library to choose who to play. As in
 * RoleCall it starts a new scene with the pick ("Start scene", "Start fresh scene" for the current one); it
 * never changes this scene's cast. The library is the studio's characters (no 60-row cap is needed to
 * search a local list).
 */
import { useEffect, useRef, useState, type JSX } from "react";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import type { OpenScene } from "../../../studio/scenes";
import { bodyOf, isRecord, str, strArray } from "../../../core/guards";
import { Button, ListRow } from "../../components/button";
import { InkDialog } from "../../components/ink-dialog";
import { usePortraitAsset } from "../../_shared/art-cache";
import { portraitUrl } from "../../_shared/asset-url";
import { toErrorMessage } from "../../_shared/error-message";
import { Ic } from "../../_shared/ic";
import { handOffScene } from "../../_shared/scene-handoff";

function Face({ s }: { s: StudioEntitySummary }): JSX.Element {
  const art = usePortraitAsset("character", s.id, s.version, s.hasPortrait ? portraitUrl("character", s.id) : null, s.revision);
  return <span className="bth-face">{art.src ? <img ref={art.ref as never} src={art.src} alt="" /> : <span>{s.name.charAt(0).toUpperCase()}</span>}</span>;
}

function CharacterLibrary({ ctx, currentId, onClose }: { ctx: AppContext; currentId: string; onClose(): void }): JSX.Element {
  const [list, setList] = useState<StudioEntitySummary[] | null>(null);
  const [query, setQuery] = useState("");
  // The shell rebuilds ctx on every status change; the list is read once per opening.
  const held = useRef(ctx);
  held.current = ctx;
  useEffect(() => {
    let live = true;
    held.current.api.listEntities("character").then((l) => live && setList(l), (e: unknown) => { if (live) { setList([]); held.current.setStatus(`could not list characters: ${toErrorMessage(e)}`); } });
    return () => { live = false; };
  }, []);
  const q = query.trim().toLowerCase();
  const shown = (list ?? []).filter((s) => !q || s.name.toLowerCase().includes(q));
  const start = (id: string): void => {
    onClose();
    ctx.api.startScene(id).then((chat) => handOffScene(chat.id), (e: unknown) => ctx.setStatus(`could not start a new scene: ${toErrorMessage(e)}`));
  };
  return (
    <InkDialog ariaLabel="Character Library" onDismiss={onClose} sheetClassName="bth-libsheet">
      <div className="bth-lib">
        <div className="bthl-eb">Character Library</div>
        <h2>Choose who to play</h2>
        <label className="bthl-search"><Ic name="lucide:search" /><input value={query} placeholder="Search characters" aria-label="Search characters" onChange={(e) => setQuery(e.target.value)} /></label>
        <div className="bth-libl">
          {list === null && <p className="bthl-quiet">Loading...</p>}
          {list !== null && shown.length === 0 && <p className="bthl-quiet">No characters found.</p>}
          {shown.map((s) => (
            <ListRow key={s.id} onClick={() => start(s.id)} leading={<Face s={s} />} label={s.name} subtitle={s.id === currentId ? "Start fresh scene" : "Start scene"} />
          ))}
        </div>
      </div>
    </InkDialog>
  );
}

export function BoothNavigator({ ctx, scene, art }: { ctx: AppContext; scene: OpenScene; art: JSX.Element }): JSX.Element {
  const [open, setOpen] = useState(false);
  const body = bodyOf(scene.snapshot.character);
  const identity = isRecord(body["identity"]) ? body["identity"] : {};
  const tags = strArray(isRecord(body["discovery"]) ? body["discovery"]["tags"] : []).slice(0, 3);
  return (
    <section className="bth-nav" data-part="scene.booth.navigator">
      <span className="bth-portrait">{art}</span>
      <b>{str(identity["name"]) || "Unknown Character"}</b>
      {str(identity["tagline"]) && <span className="bth-tagline">{str(identity["tagline"])}</span>}
      {tags.length > 0 && <span className="bth-tags">{tags.map((t) => <span className="bth-tag" key={t}>{t}</span>)}</span>}
      <div className="bth-change"><Button size="sm" icon="lucide:search" aria-label="Open character navigator" aria-expanded={open} onClick={() => setOpen(true)}>Change Character</Button></div>
      {open && <CharacterLibrary ctx={ctx} currentId={scene.chat.cast.character.id} onClose={() => setOpen(false)} />}
    </section>
  );
}
