/**
 * "Import chat history" under Advanced (RoleCall `CompendiumSettings.tsx:1508-1635`, `IngestProgressDrawer`): Cross-chunk continuity,
 * Ingest model, Tokens per chunk (1000 to 32000), the Search, Facts and Narrative phases, Run Range From and To, and `Ingest
 * Messages` / `Cancel` with a progress drawer that lists each chunk as it lands. Every control writes the field the run reads
 * (`ingest`). The run is the open book's: it needs write access, and says so when it has none. RoleCall's "TV Sidecar / Narrator"
 * is the Compendium's model / the scene's model. The drawer adds Undo this ingest, which RoleCall has no equivalent of.
 */
import { useEffect, useState, type JSX } from "react";
import { RANGES, accessOf, canWrite } from "../../../../../../core/compendium";
import { useIngest } from "../../use-ingest";
import { SettingsField, SettingsRange, SettingsSection, SettingsSegmented, SettingsToggle } from "./parts";
import type { SectionProps } from "./deps";

const MODELS = [{ value: "compendium", label: "Compendium model" }, { value: "scene", label: "Scene model" }] as const;

export function IngestSection({ ctx, chat, compendium, bookId, set }: SectionProps): JSX.Element {
  const i = compendium.resolved.ingest;
  const ingest = useIngest(ctx, chat.id);
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(0);
  useEffect(() => { if (ingest.total > 0 && to === 0) setTo(ingest.total); }, [ingest.total, to]);
  const writable = bookId !== undefined && canWrite(accessOf(chat.compendium, bookId));
  const run = ingest.run;
  const clamp = (n: number): number => Math.max(0, Math.min(ingest.total, Math.round(n) || 0));
  const can = writable && !ingest.running && (i.facts || i.narrative) && from < to;
  const patch = (field: Partial<typeof i>) => void set({ ingest: field });
  return (
    <SettingsSection id="ingest" title="Import chat history" blurb="Process existing chat messages into typed compendium entries in batch. Use this to populate the compendium from conversation history. Pick a message range and run." dot="var(--bk-role-warn)">
      <SettingsToggle on={i.continuity} onChange={(continuity) => patch({ continuity })} label="Cross-chunk continuity" hint="Send previous chunk's entries to the next chunk so the LLM doesn't double-write the same characters or locations" />
      <SettingsSegmented label="Ingest model" hint="Which model processes chat messages into typed entries" value={i.model} options={MODELS} onChange={(model) => patch({ model })} />
      <SettingsRange label="Tokens per chunk" hint="How much context the ingest model sees per call. Bigger = fewer calls but more cost per call." value={i.chunkTokens} min={RANGES.chunkTokens[0]} max={RANGES.chunkTokens[1]} step={1000} onChange={(chunkTokens) => patch({ chunkTokens })} />
      <div className="cps-phases">
        <span className="cps-lab">Phases</span>
        <SettingsToggle on={i.search} onChange={(search) => patch({ search })} label="Search" hint="Discover existing entries before writing new ones (prevents duplicates)" />
        <SettingsToggle on={i.facts} onChange={(facts) => patch({ facts })} label="Facts" hint="Extract characters, locations, items, organizations, abilities, relationships" />
        <SettingsToggle on={i.narrative} onChange={(narrative) => patch({ narrative })} label="Narrative" hint="Summarize scenes, create plots, organize entries into arcs" />
      </div>
      <SettingsField label="Run Range">
        <div className="cps-rr">
          <label>From<input type="number" aria-label="From" min={0} max={ingest.total} value={from} onChange={(e) => setFrom(clamp(Number(e.target.value)))} /></label>
          <label>To<input type="number" aria-label="To" min={0} max={ingest.total} value={to} onChange={(e) => setTo(clamp(Number(e.target.value)))} /></label>
          <small>of {ingest.total}</small>
        </div>
        <div className="cps-rr go">
          <button type="button" className="cps-btn" disabled={!can} onClick={() => void ingest.start(bookId!, from, to)}>{ingest.running ? "Ingesting..." : "Ingest Messages"}</button>
          {ingest.running && <button type="button" className="cps-btn off" onClick={() => void ingest.cancel()}>Cancel</button>}
        </div>
        {!writable && <p className="cps-note">{bookId === undefined ? "Open a book in the Compendium to ingest into it." : "This book does not allow the Compendium to write. Give it Read and write in Books in this chat."}</p>}
      </SettingsField>
      {run && (
        <div className="cps-drawer" role="status" aria-label="Ingest progress" data-part="compendium.ingest">
          <div className="hd">
            <b>{run.status === "running" ? `Reading message ${run.at} of ${run.to}` : run.status === "done" ? "Ingest complete" : run.status === "cancelled" ? "Ingest cancelled" : "Ingest failed"}</b>
            <small>{run.lines.reduce((n, l) => n + l.created, 0)} created, {run.lines.reduce((n, l) => n + l.updated, 0)} updated</small>
          </div>
          <ol>
            {run.lines.map((l) => (
              <li key={l.receiptId} className={l.status === "failed" || l.status === "interrupted" ? "bad" : undefined}>
                <b>Chunk {l.chunk}</b> messages {l.from} to {l.to - 1}: {l.status.replace("_", " ")}{l.status === "filed" ? `, ${l.created} created, ${l.updated} updated` : ""}{l.reason ? ` (${l.reason})` : ""}
              </li>
            ))}
          </ol>
          {run.status !== "running" && run.lines.some((l) => l.status === "filed") && <button type="button" className="cps-quiet" onClick={() => void ingest.undo()}>Undo this ingest</button>}
        </div>
      )}
    </SettingsSection>
  );
}
