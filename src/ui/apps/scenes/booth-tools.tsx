/**
 * The scene's tools as tiles on the Control Booth, under Narrator Tool Access (approved wireframe premiere/scene-pieces.html, 2a): an icon for what the tool does, its name, what it does in
 * plain words, what its definition costs on every reply (the tool editor rail's own count, workbench/pieces/tool-cost.ts) and a switch that links or unlinks it through the scene's own prompting
 * writer (`ChatPrompting.tools`). A cost line sums the linked tools. "+ Link a tool" lists the library's tools to link, "New tool in the Workbench" makes a blank one and opens it. A tool unlinked
 * here stays as a dimmed tile until the Booth is closed, so it can be switched back on. No count, no cap; a long list is windowed.
 */
import { useEffect, useRef, useState, type CSSProperties, type JSX } from "react";
import type { Chat } from "../../../stage/contracts/chat-store";
import type { ToolBody } from "../../../entities/tool/schema";
import { toErrorMessage } from "../../_shared/error-message";
import { apiStatusIs } from "../../_shared/api-fetch";
import { Ic } from "../../_shared/ic";
import { createBlank } from "../../_shared/new-piece";
import { VirtualRows, VirtualShelf } from "../../_shared/virtual-list";
import type { AppContext, StudioEntitySummary } from "../../app-contract";
import { Button, ListRow, Toggle } from "../../components/button";
import { toolTokens } from "../workbench/pieces/tool-cost";
import { toggleLinked } from "./messenger/panels/trackers/library-core";
import { costTotal, toolBodyOf, toolIcon, toolWords, windowShare } from "./booth-tools-core";

const TILE_ROW_PX = 112;
const PICK_ROW_PX = 52;

/** What the library says of one linked tool: its body, that it is gone (a 404), or why it could not be read (anything else: a network or server error is not "not in your library"). */
type ToolRead = { state: "ready"; body: ToolBody } | { state: "gone" } | { state: "failed"; why: string };

/**
 * The linked tools as read from the library, each read once per revision of the piece. A read is never thrown away because the list changed while it was out (it lands whenever it does, and the
 * latest read of a tool wins), a tool the piece store says changed (`ctx.pieces`: its revision moves on an edit in the Workbench) is read again so its cost is not stale, and a read that failed
 * is asked again on the next change of the list or the piece.
 */
function useToolReads(ctx: AppContext, ids: readonly string[]): ReadonlyMap<string, ToolRead> {
  const [reads, setReads] = useState<ReadonlyMap<string, ToolRead & { rev: string }>>(new Map());
  const [tick, setTick] = useState(0);
  const mounted = useRef(true);
  const latest = useRef(new Map<string, number>());
  const heldRev = useRef(new Map<string, string>());
  const key = ids.join(",");
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const bump = (): void => setTick((n) => n + 1);
    const offs = ids.map((id) => ctx.pieces?.subscribe("tool", id, bump));
    return () => { for (const off of offs) off?.(); };
    // `ids` is read through `key`: a new array with the same ids must not subscribe again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.pieces, key]);
  useEffect(() => {
    for (const id of ids) {
      const rev = ctx.pieces?.snapshot("tool", id)?.revision ?? "";
      if (heldRev.current.get(id) === rev) continue;
      heldRev.current.set(id, rev);
      const mine = (latest.current.get(id) ?? 0) + 1;
      latest.current.set(id, mine);
      const land = (read: ToolRead): void => {
        if (!mounted.current || latest.current.get(id) !== mine) return;
        // a failed read is forgotten, so the next change asks again
        if (read.state === "failed") heldRev.current.delete(id);
        setReads((m) => new Map(m).set(id, { ...read, rev }));
      };
      ctx.api.getEntity(new URLSearchParams({ kind: "tool", id }).toString()).then(
        (entity) => { const body = toolBodyOf(entity); land(body ? { state: "ready", body } : { state: "failed", why: "It is not a tool this build reads." }); },
        (e: unknown) => land(apiStatusIs(e, 404) ? { state: "gone" } : { state: "failed", why: toErrorMessage(e, "It could not be read.") }),
      );
    }
    // `ids` is read through `key`; `tick` is a piece changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.api, ctx.pieces, key, tick]);
  return reads;
}

function Tile({ id, read, tokens, on, busy, onSwitch }: { id: string; read: ToolRead | undefined; tokens: number | null; on: boolean; busy: boolean; onSwitch(on: boolean): void }): JSX.Element {
  const body = read?.state === "ready" ? read.body : null;
  const name = body?.name ?? id;
  const words = body ? toolWords(body.action) : read?.state === "gone" ? "Not in your library" : read?.state === "failed" ? `Could not be read. ${read.why}` : "Loading...";
  return (
    <div className="bth-tool" data-part={`scene.booth.tool.${id}`} data-off={on ? undefined : ""}>
      <span className="bth-tool-t">{body && <Ic name={toolIcon(body.action)} size={18} />}<b>{name}</b></span>
      <small role={read?.state === "failed" ? "alert" : undefined}>{words}</small>
      <span className="bth-tool-f">
        <span>{tokens === null ? "" : `${tokens} tok`}</span>
        <Toggle size="sm" on={on} disabled={busy} aria-label={`${on ? "Unlink" : "Link"} ${name}`} onChange={onSwitch} />
      </span>
    </div>
  );
}

/** "+ Link a tool": the library's tools, a check each. */
function Pick({ ctx, linked, busy, onToggle }: { ctx: AppContext; linked: readonly string[]; busy: boolean; onToggle(id: string, on: boolean): void }): JSX.Element {
  const [library, setLibrary] = useState<StudioEntitySummary[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    ctx.api.listEntities("tool").then((list) => { if (live) setLibrary(list); }, (e: unknown) => { if (live) { setLibrary([]); setProblem(toErrorMessage(e, "The library could not be read.")); } });
    return () => { live = false; };
  }, [ctx.api]);
  return (
    <div className="bth-tools-pick" data-part="scene.booth.tools.pick">
      {problem && <p className="bth-note warn" role="alert">{problem}</p>}
      {library === null ? <p role="status">Loading...</p> : library.length === 0 && !problem ? <p>The library has no tools yet.</p> : (
        <VirtualRows items={library} keyOf={(p) => p.id} estimate={PICK_ROW_PX}
          render={(p) => <ListRow data-part={`scene.booth.tools.pick.${p.id}`} variant="option" selected={linked.includes(p.id)} aria-pressed={linked.includes(p.id)} disabled={busy} label={p.name} onClick={() => onToggle(p.id, !linked.includes(p.id))} />} />
      )}
    </div>
  );
}

export function ToolTiles({ ctx, chat, onChanged, windowTokens, accessOn }: { ctx: AppContext; chat: Chat; onChanged(chat: Chat): void; /** Whether Narrator Tool Access is on: with it off no tool is sent, and the cost line says so instead of a figure. */ accessOn: boolean; /** The scene model's context window, when known: the cost bar shows the share the tools take of it. */ windowTokens?: number | undefined }): JSX.Element {
  const linked = chat.prompting?.tools ?? [];
  const [kept, setKept] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const ids = [...linked, ...kept.filter((k) => !linked.includes(k))];
  const reads = useToolReads(ctx, ids);
  const tokens = (id: string): number | null => { const r = reads.get(id); return r?.state === "ready" ? toolTokens(r.body) : null; };
  const total = costTotal(linked.flatMap((id) => tokens(id) ?? []));
  const share = windowShare(total, windowTokens);

  const run = async (work: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setProblem(null);
    try { await work(); } catch (e) { setProblem(toErrorMessage(e, "That could not be saved.")); } finally { setBusy(false); }
  };
  const link = (id: string, on: boolean): Promise<void> => run(async () => {
    const next = toggleLinked(linked, id, on);
    onChanged(await ctx.api.setScenePrompting(chat.id, { tools: next.length === 0 ? null : next }));
    if (!on) setKept((k) => (k.includes(id) ? k : [...k, id]));
  });
  const create = (): Promise<void> => run(async () => {
    const made = await createBlank(ctx, "tool");
    ctx.workbench.open(made);
    ctx.openApp("workbench");
  });

  return (
    <div className="bth-tools" data-part="scene.booth.tools">
      {ids.length > 0 && (
        <div className="bth-tools-scroll">
          <VirtualShelf items={ids} keyOf={(id) => id} rowClass="bth-tools-row" estimate={TILE_ROW_PX}
            render={(id) => <Tile id={id} read={reads.get(id)} tokens={tokens(id)} on={linked.includes(id)} busy={busy} onSwitch={(on) => void link(id, on)} />} />
        </div>
      )}
      {linked.length > 0 && (
        <div className="bth-tools-cost" data-part="scene.booth.tools.cost">
          <span>{accessOn ? "Per reply" : "Per reply, while tool access is off"}</span>
          {accessOn && share !== null && <span className="bth-tools-bar" role="meter" aria-label="Share of the model's window" aria-valuenow={Math.round(share * 100)} aria-valuemin={0} aria-valuemax={100} style={{ "--fill": `${share * 100}%` } as CSSProperties}><i /></span>}
          {accessOn ? <b>~{total} tokens</b> : <b>not sent</b>}
        </div>
      )}
      {problem && <p className="bth-note warn" role="alert">{problem}</p>}
      <div className="bth-tools-act">
        <Button data-part="scene.booth.tools.link" size="sm" icon="lucide:plus" aria-pressed={picking} onClick={() => setPicking(!picking)}>Link a tool</Button>
        <Button data-part="scene.booth.tools.new" size="sm" variant="quiet" disabled={busy} onClick={() => void create()}>New tool in the Workbench</Button>
      </div>
      {picking && <Pick ctx={ctx} linked={linked} busy={busy} onToggle={(id, on) => void link(id, on)} />}
    </div>
  );
}
