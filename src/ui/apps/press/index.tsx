/**
 * The Press - the locked vs-press-room-1 room, staging grammar: no studio browser in here. Pieces
 * arrive via "Stage for the Press" (the shell entity menu, the offer rail); the room works ONLY the
 * staged queue, grouped as BUNDLES (a character owns his linked lorebooks; riders droppable per run),
 * each card carrying its readiness against the run's target (readiness-core over the same coverage
 * claims the Write-for lens trusts). One target per run, filenames + flavors per row, the lever,
 * one zip out. Ledger and drag-reorder are follow-up slices, named here so absence reads as
 * not-yet, never as done.
 */
import { kindOf } from "../../../generated/kinds";
import { Button, ListRow, Segmented } from "../../components/button";
import { OverlayWidgets } from "./overlay";
import { Panel } from "../../components/panel";
import { RoomHeader } from "../../components/room-header";
import { useEffect, useMemo, useState, type CSSProperties, type JSX } from "react";
import { deckMeta } from "../../_shared/decks";
import type { AppContext, CoverageInfo, StudioEntitySummary, BunzaiApp } from "../../app-contract";
import { SETTING_KEYS } from "../../../studio/settings-shape";
import { mediaExportSummary } from "../../components/export-dialog/honesty";
import { drainToBlob, saveBlob } from "../../_shared/download-sink";
import { streamOf } from "../../_shared/byte-stream";
import { zipStored } from "../../../core/media/pack-zip";
import { toErrorMessage } from "../../_shared/error-message";
import {
  flavorChoosable,
  flavorExtension,
  foldSummary,
  groupPlatforms,
  mintFilename,
  payloadBytes,
  planRun,
  type FileFlavor,
  type PressPlatform,
  type RunRow,
} from "./press-core";
import { isRecord, strArray } from "../../../core/guards";
import { lorebookKeyGap, readiness, readinessLine } from "./readiness-core";
import { groupBundles, packageRun, pieceKeyOf, riderRefsOf, runSet, type RiderRef } from "./press-bundles";
import { PRESS_AGENT_SURFACE, usePublishPressSurface } from "./agent-surface";
import styles from "./styles.module.css";
import "./variant-styles";
import { asciiSlug } from "../../../core/text";
import { icSvg } from "../../_shared/ic-svg";
import { digitRuns } from "../../_shared/digit-runs";

/** the locked press mark (vs-shell-apps) */
const MARK_SVG = icSvg("lucide:printer", 18);

/** a piece kind's deck color for a card or stamp (unknown kinds read as fog), from the kind hub */
const deckStyle = (kind: string): CSSProperties => ({ "--deck": deckMeta(kind).accent } as CSSProperties);

/** gold mono numerals inside a summary line */
const numerals = (text: string): (JSX.Element | string)[] => digitRuns(text, styles.num);

function Press({ ctx }: { ctx: AppContext }): JSX.Element {
  const [queue, setQueue] = useState<StudioEntitySummary[]>(() => ctx.press.queue());
  const [allSummaries, setAllSummaries] = useState<StudioEntitySummary[]>([]);
  const [platforms, setPlatforms] = useState<PressPlatform[]>([]);
  const [coverage, setCoverage] = useState<CoverageInfo[]>([]);
  const [entities, setEntities] = useState<Record<string, unknown>>({});
  const [dropped, setDropped] = useState<Set<string>>(() => new Set());
  const [target, setTarget] = useState<string>("");
  const [rows, setRows] = useState<RunRow[] | null>(null);
  const [running, setRunning] = useState(false);
  const [zip, setZip] = useState<{ blob: Blob; filename: string } | null>(null);
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const [flavors, setFlavors] = useState<Record<string, FileFlavor>>({});
  const [loadNote, setLoadNote] = useState<string | null>(null);

  // the queue is shell state (survives app switches); this room mirrors it live
  useEffect(() => ctx.press.onChange(() => setQueue(ctx.press.queue())), [ctx]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [list, formats, cov] = await Promise.all([
          ctx.api.listEntities(),
          ctx.api.formats(),
          ctx.api.coverage(),
        ]);
        if (cancelled) return;
        setAllSummaries(list);
        const grouped = groupPlatforms(formats);
        setPlatforms(grouped);
        setCoverage(cov);
        // the setup/Settings publish answer finally DOES something here: the first pick that
        // exists in the roster starts selected (an untouched room otherwise starts unselected)
        const picksRaw = ctx.prefs.get(SETTING_KEYS.publishTargets);
        const picks = strArray(picksRaw);
        const preferred = picks.find((p) => grouped.some((g) => g.friendly === p));
        if (preferred) setTarget((t) => (t === "" ? preferred : t));
      } catch {
        if (!cancelled) setLoadNote("could not load the studio · the server may be unreachable");
      }
    })();
    return () => {
      cancelled = true;
    };
    // mount-once snapshot, same rule as the workbench rail
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refsByOwner = useMemo(() => {
    const out: Record<string, RiderRef[]> = {};
    for (const p of queue) {
      // Owners are the kinds that declare links (core/links.ts); their riders are what they link.
      const refs = riderRefsOf(p, entities[pieceKeyOf(p)]);
      if (refs.length > 0) out[pieceKeyOf(p)] = refs;
    }
    return out;
  }, [queue, entities]);

  const grouping = useMemo(() => groupBundles(queue, allSummaries, refsByOwner), [queue, allSummaries, refsByOwner]);

  // Fetch bodies for the queue AND bundle riders (readiness + bundle links need them; the run reuses the
  // cache). Riders arrive one pass late by design: fetching an owner reveals his refs, the grouping
  // gains the rider, this effect refires and fetches him. Rider bodies never change the grouping,
  // so it settles in two passes.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const wanted = [...queue, ...grouping.bundles.flatMap((k) => k.riders)];
      for (const p of wanted) {
        const key = pieceKeyOf(p);
        if (entities[key] !== undefined || kindOf(p.kind)?.heavy) continue; // a heavy kind (a pack) has no readiness line, and is never read whole
        try {
          const e = await ctx.api.getEntity(
            `kind=${encodeURIComponent(p.kind)}&id=${encodeURIComponent(p.id)}`,
          );
          if (cancelled) return;
          setEntities((prev) => ({ ...prev, [key]: e }));
        } catch {
          // a failed fetch leaves readiness honest-unknown; the run reports its own failure
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // entities is the cache being filled; keying on it would loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, grouping, ctx]);
  const platform = platforms.find((p) => p.friendly === target) ?? null;
  const set = useMemo(() => runSet(grouping, dropped), [grouping, dropped]);
  const staged = new Set(queue.map(pieceKeyOf));
  const offers = allSummaries.filter((s) => !staged.has(pieceKeyOf(s)));

  // the agent window's live half: what is staged, what it prints for, and how the last run went
  usePublishPressSurface(ctx, {
    queue, target, rows, running, zipReady: zip !== null, loadFailed: loadNote !== null,
  });

  const covFor = (kind: string): CoverageInfo | undefined =>
    kind === "character" && platform
      ? coverage.find((c) => c.label === platform.friendly) ?? coverage.find((c) => c.id === platform.byKind.character?.id)
      : undefined;

  const readinessOf = (p: StudioEntitySummary): { line: string; tone: "ok" | "warn" | "bad" | "dim" } | null => {
    const entity = entities[pieceKeyOf(p)];
    if (entity === undefined) return { line: "reading the piece…", tone: "dim" };
    const body = isRecord(entity) ? entity.body : undefined;
    if (p.kind === "lorebook") {
      const gap = lorebookKeyGap(body);
      const entries = (n: number): string => (n === 1 ? "1 entry" : `${n} entries`);
      if (gap.total > 0 && gap.keyless === gap.total)
        return { line: "no entry has keywords - it will never fire", tone: "bad" };
      if (gap.keyless > 0)
        return { line: `${entries(gap.keyless)} of ${gap.total} without keywords`, tone: "warn" };
      return { line: `${entries(gap.total)} · keys fine`, tone: "ok" };
    }
    if (p.kind === "character" && platform) {
      const r = readiness(body, covFor(p.kind));
      if (r.verdict === "unknown") return null;
      return { line: readinessLine(r), tone: r.verdict === "ready" ? "ok" : "warn" };
    }
    return null;
  };

  const resetRun = (): void => {
    setRows(null);
    setZip(null);
  };

  const run = async (): Promise<void> => {
    if (!platform || set.length === 0 || running) return;
    setRunning(true);
    setZip(null);
    const plan = planRun(set, platform);
    setRows([...plan]);
    const files: Record<string, Blob> = {};
    const taken = new Set<string>();

    for (let i = 0; i < plan.length; i++) {
      const row = plan[i]!;
      if (row.status !== "wait" || !row.targetId) continue;
      const rowKey = `${row.kind}:${row.id}`;
      try {
        if (row.kind === "pack" && row.targetId === "image-pack") {
          // A pack is printed by reference: the server reads each picture as its turn in the archive comes,
          // and the archive lands in a Blob as it streams in, so it is never one array here or there.
          const blob = await drainToBlob(await ctx.api.exportStoredPack(row.id), "application/zip");
          const filename = mintFilename(fileNames[rowKey]?.trim() || row.name, "zip", taken);
          files[filename] = blob;
          plan[i] = { ...row, status: "ok", filename };
          setRows([...plan]);
          continue;
        }
        const entity =
          entities[rowKey] ??
          (await ctx.api.getEntity(`kind=${encodeURIComponent(row.kind)}&id=${encodeURIComponent(row.id)}`));
        const out = await ctx.api.exportEntity(entity, row.targetId);
        if (!out || (isRecord(out) && "error" in out)) {
          const msg = isRecord(out) && typeof out.error === "string" ? out.error : "export failed";
          throw new Error(msg);
        }
        const payload = out;
        const bytes = payloadBytes(payload);
        if (!bytes) throw new Error("empty export payload");
        const flavor = flavorChoosable(payload.suggestedExtension) ? (flavors[rowKey] ?? "normal") : "normal";
        const filename = mintFilename(
          fileNames[rowKey]?.trim() || row.name,
          flavorExtension(payload.suggestedExtension, flavor),
          taken,
        );
        files[filename] = new Blob([bytes as BlobPart]);
        const body = isRecord(entity) ? entity.body : undefined;
        const original = isRecord(entity) ? entity.original : undefined;
        const chips = row.kind === "character" ? mediaExportSummary(body, original).chips : [];
        const carries = chips.length > 0 ? `carries: ${chips.join(" · ")}` : undefined;
        const droppedCount = out.report.dropped.length;
        const reportLine = out.report.coverage === "unknown"
          ? `loss unknown${droppedCount > 0 ? `; at least ${droppedCount} field${droppedCount === 1 ? "" : "s"} not carried` : ""}`
          : droppedCount > 0
            ? `${droppedCount} field${droppedCount === 1 ? "" : "s"} not carried`
            : out.report.warnings[0];
        plan[i] = {
          ...row,
          status: reportLine ? "warn" : "ok",
          filename,
          info: [row.info, carries, reportLine].filter(Boolean).join(" · ") || undefined,
        };
      } catch (e) {
        plan[i] = { ...row, status: "fail", note: toErrorMessage(e) };
      }
      setRows([...plan]);
    }

    const packed = packageRun(files);
    if (packed?.kind === "single") {
      // One piece in, one file out: no zip ceremony around a single preset.
      setZip({ blob: packed.bytes, filename: packed.filename });
    } else if (packed) {
      // The outer zip is written one output at a time (stored, no recompression) into a Blob.
      const entries = Object.entries(packed.files).map(([name, blob]) => ({ name, bytes: async () => new Uint8Array(await blob.arrayBuffer()) }));
      const zipped = await drainToBlob(new Response(streamOf(zipStored(entries))), "application/zip");
      const stamp = asciiSlug(platform.friendly);
      setZip({ blob: zipped, filename: `vaude-press-${stamp}.zip` });
    }
    ctx.setStatus(`press run · ${foldSummary(plan)}`);
    setRunning(false);
  };

  const rowFor = (r: RunRow[] | null, p: StudioEntitySummary): RunRow | undefined =>
    r?.find((x) => x.id === p.id && x.kind === p.kind);

  const card = (p: StudioEntitySummary, rider?: { of: string }): JSX.Element => {
    const key = pieceKeyOf(p);
    const ready = readinessOf(p);
    const row = rowFor(rows, p);
    const adapter = platform?.byKind[p.kind];
    const borrowed = platform?.borrowed?.[p.kind];
    const isDropped = rider !== undefined && dropped.has(key);
    return (
      <div key={key} data-deck={p.kind} style={deckStyle(p.kind)} className={`${styles.kcard}${isDropped ? ` ${styles.kcardDropped}` : ""}`}>
        <span
          className={`${styles.dot}${
            row?.status === "ok" ? ` ${styles.dotOk}` : row?.status === "fail" ? ` ${styles.dotFail}` : ready?.tone === "ok" ? ` ${styles.dotOk}` : ready?.tone === "warn" ? ` ${styles.dotWarn}` : ready?.tone === "bad" ? ` ${styles.dotFail}` : ""
          }`}
        />
        <b className={styles.kname}>{p.name}</b>
        <span className={styles.jkind}>
          {p.kind}
          {rider ? " · rides with " + rider.of : ""}
          {borrowed ? " · prints as a CCv3 card" : ""}
        </span>
        {rider && (
          <Button
            size="sm"
            variant="quiet"
            onClick={() => {
              setDropped((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              });
              resetRun();
            }}
          >
            {isDropped ? "ride again" : "drop from this run"}
          </Button>
        )}
        {!isDropped && ready && (
          <span className={`${styles.jinfo}${ready.tone === "warn" ? ` ${styles.jnote}` : ready.tone === "bad" ? ` ${styles.jnote} ${styles.jnoteFail}` : ""}`}>
            {ready.line}
            {ready.tone !== "ok" && ready.tone !== "dim" && (
              <>
                {" · "}
                <Button size="sm" variant="quiet" onClick={() => ctx.workbench.send(p)}>
                  Open in the editor
                </Button>
              </>
            )}
          </span>
        )}
        {row?.note && <span className={`${styles.jnote} ${styles.jnoteFail}`}>{row.note}</span>}
        {row?.info && <span className={styles.jinfo}>{row.info}</span>}
        {row?.filename && <span className={styles.jfile}>{row.filename}</span>}
        {!isDropped && !rows && adapter && (
          <span className={styles.fileEdit}>
            <input
              className={styles.fileIn}
              value={fileNames[key] ?? p.name}
              aria-label={`filename for ${p.name}`}
              onChange={(e) => setFileNames((prev) => ({ ...prev, [key]: e.target.value }))}
            />
            {flavorChoosable(adapter.outputExtensions[0] ?? "") && (
              <Segmented
                size="sm"
                label={`file type for ${p.name}`}
                value={flavors[key] ?? "normal"}
                onChange={(f) => setFlavors((prev) => ({ ...prev, [key]: f }))}
                items={(["normal", "txt", "md"] as const).map((f) => ({ value: f, label: f === "normal" ? `.${(adapter.outputExtensions[0] ?? "json").replace(/^\./, "")}` : `.${f}` }))}
              />
            )}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className={styles.roomHost}>
      <RoomHeader
        data-part="press.header"
        kicker="Convert files"
        title="The Press"
        lede="Stage pieces from the Library, pick a platform, and print them to its file format."
      />
      <div className={styles.room2} data-part="press.room">
        <Panel as="aside" data-part="press.rail" className={`${styles.rail} scrollThin`}>
          <span className={styles.kick}>from the library · click to stage</span>
          {loadNote && (
            <div className={`${styles.notice} ${styles.noticeFail}`}>
              <span className={styles.kick}>Offline</span>
              <p>{loadNote}</p>
            </div>
          )}
          <div className={styles.offerList} data-part="press.offers">
            {offers.map(/* bounded-ok: fixed app / doc / deck-kind / store sets, or short per-import summaries */ (s) => (
              <div key={pieceKeyOf(s)} className={styles.stamp} data-deck={s.kind} style={deckStyle(s.kind)} data-part={`press.offer.stamp.${s.id}`}>
                <ListRow data-part="press.offer" onClick={() => ctx.press.stage([s])} label={s.name || s.id} meta={<span className={styles.kindTag}>{s.kind}</span>} />
              </div>
            ))}
            {offers.length === 0 && <p className={`${styles.notice} ${styles.empty}`}>everything is staged</p>}
          </div>
        </Panel>

        <section data-part="press.queue">
          <div className={styles.sheetHead}>
            <span className={styles.kick}>
              {numerals(`the queue · ${queue.length} staged${dropped.size > 0 ? ` · ${dropped.size} dropped` : ""}`)}
            </span>
            <span className={styles.targets}>
              <Segmented
                size="sm"
                label="Target platform"
                value={target ?? ""}
                onChange={(friendly) => {
                  setTarget(friendly);
                  resetRun();
                }}
                items={platforms.map((p) => ({ value: p.friendly, label: p.friendly }))}
              />
            </span>
          </div>

          {queue.length === 0 ? (
            <Panel data-part="press.empty" className={styles.moment} data-empty>
              <span className={styles.kick}>The press is idle</span>
              <h2 className={styles.momentTitle}>Nothing staged</h2>
              <p>
                Stage pieces from the Library - right-click any piece, or use the rail
                on the left. A staged character brings its linked lorebooks as a bundle.
              </p>
            </Panel>
          ) : (
            <>
              {grouping.bundles.map(/* bounded-ok: fixed app / doc / deck-kind / store sets, or short per-import summaries */ (bundle) => (
                <Panel key={pieceKeyOf(bundle.owner)} data-part="press.bundle" deck={bundle.owner.kind} className={styles.bundle}>
                  <div className={styles.bundleMarq}>
                    <span className={styles.kick}>bundle</span>
                    <h2 className={styles.bundleName}>{bundle.owner.name}</h2>
                    <span className={styles.bundleCount}>{bundle.riders.length > 0 ? numerals(`${deckMeta(bundle.owner.kind).singular.toLowerCase()} + ${bundle.riders.length} linked`) : deckMeta(bundle.owner.kind).singular.toLowerCase()}</span>
                    <Button size="sm" variant="quiet" onClick={() => ctx.press.unstage(bundle.owner.id, bundle.owner.kind)}>
                      Unstage ×
                    </Button>
                  </div>
                  {card(bundle.owner)}
                  {bundle.riders.map((r) => card(r, { of: bundle.owner.name }))}
                </Panel>
              ))}
              {grouping.solos.map(/* bounded-ok: fixed app / doc / deck-kind / store sets, or short per-import summaries */ (s) => (
                <Panel key={pieceKeyOf(s)} data-part="press.bundle" deck={s.kind} className={styles.bundle}>
                  <div className={styles.bundleMarq}>
                    <span className={styles.kick}>solo</span>
                    <h2 className={styles.bundleName}>{s.name}</h2>
                    <span className={styles.bundleCount}>{s.kind}</span>
                    <Button size="sm" variant="quiet" onClick={() => ctx.press.unstage(s.id, s.kind)}>
                      Unstage ×
                    </Button>
                  </div>
                  {card(s)}
                </Panel>
              ))}
            </>
          )}

          <div className={styles.foot} data-part="press.foot">
            <span className={styles.sum}>
              {numerals(rows
                ? foldSummary(rows)
                : platform
                  ? foldSummary(planRun(set, platform))
                  : `${set.length} in the run · pick a platform`)}
            </span>
            {zip && (
              <Button onClick={() => void saveBlob(zip.blob, zip.filename)}>
                Download the bundle
              </Button>
            )}
            {rows && !running && (
              <Button variant="quiet" onClick={resetRun}>
                Clear the results
              </Button>
            )}
            {queue.length > 0 && !running && (
              <Button variant="danger" onClick={() => { ctx.press.clear(); resetRun(); }}>
                Clear the queue
              </Button>
            )}
            <Button
              variant="primary"
              disabled={!platform || set.length === 0 || running}
              title={!platform ? "Pick a target platform first" : undefined}
              onClick={() => void run()}
            >
              {running ? "printing…" : "run the press"}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

const app: BunzaiApp = {
  OverlayWidgets,
  manifest: {
    id: "press",
    title: "The Press",
    markSvg: MARK_SVG,
    accent: "#8b5cf6", // hardcode-ok: per-app identity accent, not theming
    order: 30,
    subtitle: "Convert files",
    agentSurface: PRESS_AGENT_SURFACE,
  },
  Component: Press,
};

export default app;
