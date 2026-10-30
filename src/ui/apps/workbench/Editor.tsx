/**
 * Character editor shell: draft/save/lens state and presenter choice.
 * Field bodies and layouts live in presenters/; controls in controls/.
 */
import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import type { JSX, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { deepEq, recOr, strArray } from "../../../core/guards";
import type { AppContext, CoverageInfo, StudioEntitySummary } from "../../app-contract";
import { completionOf, EDITOR_CARDS, lensVerdict, readPath, reconcileOrder, writePath } from "./editor-core";
import { signatureFromPng } from "../../../studio/signature-color";
import { portraitUrl } from "../../_shared/asset-url";
import { getPortraitBlob, usePieceArtIdentity } from "../../_shared/art-cache";
import type { Stub } from "../../components/native-card";
import { useVariants } from "./use-variants";
import { type SpritePackValue } from "../../../core/media";
import { bodyWithFaceOnly, bodyWithPack, originalWithPack } from "./media/session";
import { originalWithNamed } from "../../../formats/_shared/media-bridge";
import { str } from "./editor-derive";
import { CharacterEditorView } from "./presenters/character-editor-view";
import { buildEditorBodyViews } from "./presenters/editor-body-views";
import { EditorLeftCard, mediaBundle, resolveArtUrl } from "./presenters/editor-left";
import { runEditorSave } from "./editor-save";
import { rowsOfNamed, saveCharacterPatch } from "./character-patch-save";
import { acceptedNativeBaseline } from "./character-native-baseline";
import { useCharacterNamedAssets } from "./character-named-assets";
import { referencedAssetUploads, useAssetUploads } from "../../_shared/asset-upload";
import { EditorMutationLedger, EditorSaveQueue, type EditorTouch } from "../../_shared/editor-state";
import type { SaveIntent } from "../../../stage/contracts/content-store";
import { useEditorGuards } from "./use-editor-guards";
import { useCharacterPreferences } from "./use-character-preferences";
import { useCharacterPackCatalog } from "./use-character-pack-catalog";
import { characterDraftTouch, type CharacterDraft, useCharacterHistory } from "./use-character-history";
import styles from "./editor-styles";

function scopedDraftTouch(scope: "body" | "original", part?: EditorTouch<Record<string, unknown>>): EditorTouch<CharacterDraft> {
  return part
    ? {
      key: `${scope}:${part.key}`,
      read: (draft) => part.read(draft[scope]),
      ...(part.write ? { write: (draft, value) => ({ ...draft, [scope]: part.write!(draft[scope], value) }) } : {}),
    }
    : {
      key: scope,
      read: (draft) => draft[scope],
      write: (draft, value) => ({ ...draft, [scope]: value as Record<string, unknown> }),
    };
}
const risuNamedTouch: EditorTouch<Record<string, unknown>> = {
  key: "risu:namedAssets",
  read: (original) => original.risu,
  write: (original, value) => {
    const next = { ...original };
    if (value === undefined) delete next.risu;
    else next.risu = value;
    return next;
  },
};

export interface CharacterEditorProps {
  /** the fetched entity (summary fields + canonical body) - fetched once by the caller */
  entity: unknown;
  revision: string;
  ctx: AppContext;
  piece: StudioEntitySummary;
  /** room chrome hoisted into the editor's own tab strip (the focus toggle) - no crumb bar exists */
  topRight?: ReactNode;
}
export function CharacterEditor({ entity, revision, ctx, piece, topRight }: CharacterEditorProps): JSX.Element {
  const {
    targets, toggleTarget, clearTargets, offTarget, pickOffTarget,
    editorScale, setEditorScale, stepScale, editorLayout, setEditorLayout,
    mode, setMode, onboarded, scaleMin, scaleMax,
  } = useCharacterPreferences(ctx);
  const revisionRef = useRef(revision);
  const [init] = useState(() => {
    const ent = recOr(entity);
    const baseline = structuredClone(recOr(ent.body));
    const savedOrder = recOr(baseline.presentation).fieldOrder;
    return {
      ent,
      baseline,
      hadOrder: Array.isArray(savedOrder) && savedOrder.length > 0,
      order: reconcileOrder(savedOrder),
    };
  });
  const [baseline, setBaseline] = useState(init.baseline);
  const [baseDraft, setBaseDraftRaw] = useState(init.baseline);
  const initOriginal = (): Record<string, unknown> => recOr(init.ent.original ?? init.ent.escrow ?? {});
  const [originalDraft, setOriginalDraftRaw] = useState(() => structuredClone(initOriginal()));
  const nativeBaseline = useRef(structuredClone(initOriginal()));
  const loadedNativeFormats = useRef(new Set(Object.keys(initOriginal())));
  const [edited, setEdited] = useState(false);
  const editEpoch = useRef(0);
  const draftRef = useRef({ body: baseDraft, original: originalDraft });
  const mutation = useRef<EditorMutationLedger<CharacterDraft> | null>(null);
  mutation.current ??= new EditorMutationLedger(draftRef.current);
  const markEdited = useCallback((next: CharacterDraft, touch: EditorTouch<CharacterDraft> = characterDraftTouch, reconcile = false) => {
    editEpoch.current++;
    mutation.current!.track(next, touch, editEpoch.current, reconcile);
    setEdited(mutation.current!.dirty);
  }, []);
  useEffect(() => { draftRef.current = { body: baseDraft, original: originalDraft }; }, [baseDraft, originalDraft]);
  const recordDraft = useCallback((body: Record<string, unknown>, original: Record<string, unknown>, touch: EditorTouch<CharacterDraft>) => {
    const before = draftRef.current;
    const after = { body, original };
    if (before.body !== body || before.original !== original) {
      mutation.current!.history.record(
        { touch, value: touch.read(before) },
        { touch, value: touch.read(after) },
      );
    }
    draftRef.current = after;
    markEdited(after, touch);
  }, [markEdited]);
  const setBaseDraft = useCallback((update: SetStateAction<Record<string, unknown>>, part?: EditorTouch<Record<string, unknown>>) => {
    const next = typeof update === "function" ? update(draftRef.current.body) : update;
    recordDraft(next, draftRef.current.original, scopedDraftTouch("body", part));
    setBaseDraftRaw(next);
  }, [recordDraft]);
  const setOriginalDraft = useCallback((update: SetStateAction<Record<string, unknown>>, part?: EditorTouch<Record<string, unknown>>) => {
    const next = typeof update === "function" ? update(draftRef.current.original) : update;
    recordDraft(draftRef.current.body, next, scopedDraftTouch("original", part));
    setOriginalDraftRaw(next);
  }, [recordDraft]);
  // portrait-strip variants: `draft` DISPLAYS the base with the active variant merged in, and `setField`
  // writes either the base or the active variant's overrides. Save + dirty stay on baseDraft. (use-variants)
  const vary = useVariants(baseDraft, setBaseDraft);
  const draft = vary.draft;
  const setField = vary.setField;
  // Native format fields edit separately from the canonical body; preserve the pre-rename key.
  const named = useCharacterNamedAssets(ctx.api, piece.id, revisionRef, piece.version);
  const { projection: namedProjection, uploads: namedUploads, baselineRows: namedBaselineRows, apply: applyNamedAssets } = named;
  const { uploads: mediaUploads, uploadAsset, uploadBatch, transferAssets, stageAsset, accept: acceptMediaUploads, discard: discardUploads, pin: pinUploads, unpin: unpinUploads, discardUnused } = useAssetUploads(
    ctx.api.uploadAsset,
    ctx.api.discardAssetUploads,
    () => ctx.setStatus("Could not stage that media file."),
  );
  const [order] = useState(init.order);
  const orderBaselineRef = useRef(init.order);
  const [saving, setSaving] = useState(false);
  const [flowIndex, setFlowIndex] = useState(0); // how many questions the guided flow has revealed
  const [workshop, setWorkshop] = useState(false); // the behavior/scripts workspace, beside the field editor
  const [exportOpen, setExportOpen] = useState(false);
  const [exportEntity, setExportEntity] = useState<unknown>(init.ent);
  const [spritesOpen, setSpritesOpen] = useState(false);
  const [spritesFocusLabel, setSpritesFocusLabel] = useState<string | null>(null);
  const [namedOpen, setNamedOpen] = useState(false);
  const packCatalog = useCharacterPackCatalog(ctx.api, piece.id, spritesOpen);
  const activeCardRef = useRef<HTMLDivElement>(null);

  // drag-resizable split between the question card and the stage (the user sets the balance)
  const [splitPct, setSplitPct] = useState(42);
  const quizRef = useRef<HTMLDivElement>(null);
  const onSplitDown = (e: ReactPointerEvent): void => {
    e.preventDefault();
    const move = (ev: PointerEvent): void => {
      const el = quizRef.current;
      if (el === null) return;
      const r = el.getBoundingClientRect();
      const pct = ((ev.clientX - r.left) / r.width) * 100;
      setSplitPct(Math.max(24, Math.min(72, pct)));
    };
    const up = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  useEffect(() => {
    activeCardRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [flowIndex]);

  // the character's own accent, derived from its portrait art (signatureColor), lights the stage.
  // Client-side decode: the portrait bytes are fetched once and reduced to one hue; failure = no color.
  const [artAccent, setArtAccent] = useState<string | null>(null);
  const artIdentity = usePieceArtIdentity(ctx.pieces, piece.kind, piece.id, piece.writeId ?? 0, piece.revision ?? "");
  useEffect(() => {
    if (!piece.hasPortrait) {
      setArtAccent(null);
      return;
    }
    let cancelled = false;
    const url = portraitUrl(piece.kind, piece.id);
    void (async () => {
      try {
        const blob = await getPortraitBlob(piece.kind, piece.id, piece.version, url, artIdentity);
        const color = signatureFromPng(new Uint8Array(await blob.arrayBuffer()));
        if (!cancelled && color !== null) setArtAccent(color);
      } catch {
        // no accent; the stage falls back to the house accent
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [piece.id, piece.kind, piece.hasPortrait, piece.version, piece.writeId, piece.revision, artIdentity]);
  const [coverage, setCoverage] = useState<CoverageInfo[]>([]);
  useEffect(() => {
    let live = true;
    for (const format of targets) {
      if (format === "vaud-studio" || format === "vaud-json" || loadedNativeFormats.current.has(format)) continue;
      void (async () => {
        for (let attempt = 0; attempt < 3 && live; attempt++) {
          const expected = revisionRef.current;
          const read = await ctx.api.getEditableOriginalEntryVersioned("character", piece.id, format);
          if (!live || !read) return;
          if (read.revision !== expected || revisionRef.current !== expected) continue;
          const nativeTouch = scopedDraftTouch("original", {
            key: format,
            read: (value) => value[format],
            write: (value, next) => ({ ...value, [format]: next }),
          });
          if (mutation.current!.hasTouchOverlapping(nativeTouch.key) || mutation.current!.hasPendingOverlapping(nativeTouch.key)) return;
          loadedNativeFormats.current.add(format);
          if (read.entry === null) return;
          mutation.current!.hydrateBaseline(nativeTouch, read.entry);
          const original = { ...draftRef.current.original, [format]: read.entry };
          nativeBaseline.current = { ...nativeBaseline.current, [format]: structuredClone(read.entry) };
          draftRef.current = { ...draftRef.current, original };
          setOriginalDraftRaw(original);
          return;
        }
      })().catch(() => undefined);
    }
    return () => { live = false; };
  }, [targets, ctx.api, piece.id, edited]);
  useEffect(() => {
    if (named.readState !== "available" || !namedProjection || mutation.current!.hasTouchOverlapping("original:risu") || mutation.current!.hasPendingOverlapping("original:risu")) return;
    const currentRows = rowsOfNamed(mediaBundle(baseDraft, draftRef.current.original, targets).namedBag);
    if (deepEq(currentRows, namedBaselineRows.current)) return;
    const hydrated = originalWithNamed(draftRef.current.original, namedProjection);
    mutation.current!.hydrateBaseline(scopedDraftTouch("original", risuNamedTouch), hydrated.risu);
    draftRef.current = { ...draftRef.current, original: hydrated };
    nativeBaseline.current = { ...nativeBaseline.current, risu: structuredClone(hydrated.risu) };
    setOriginalDraftRaw(hydrated);
  }, [named.readState, namedProjection, baseDraft, targets, namedBaselineRows]);
  useEffect(() => {
    void ctx.api.coverage().then(setCoverage).catch(() => setCoverage([]));
    // mount-once: coverage claims change only when formats change (a rebuild), never mid-session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const orderDirty = !deepEq(order, orderBaselineRef.current);
  const dirty = edited || orderDirty;
  const setNative = (path: string, value: unknown): void => setOriginalDraft(
    (d) => writePath(d, path, value),
    { key: path, read: (d) => readPath(d, path), write: (d, next) => writePath(d, path, next) },
  );
  // one stub-modal state for the whole editor: a native link-out (lorebook/regex) opens it, both layouts share it
  const [nativeStub, setNativeStub] = useState<Stub | null>(null);
  const text = (path: string): string => str(readPath(draft, path));
  const openExport = async (): Promise<void> => {
    try {
      const full = await ctx.api.getEditableEntity(`kind=character&id=${encodeURIComponent(piece.id)}`);
      setExportEntity(full.entity);
      setExportOpen(true);
    } catch { ctx.setStatus("could not load the sealed source for export"); }
  };

  const platformLabel = useCallback(
    (id: string): string => {
      const hit = coverage.find((c) => c.id === id);
      return hit ? (hit.label.split(" ")[0] ?? id) : id;
    },
    [coverage],
  );
  const done = completionOf(draft);
  const lensClean = targets.length > 0 && EDITOR_CARDS.every((c) => lensVerdict(c.paths, targets, coverage).missing.length === 0);
  const chips = [
    ["Portrait", done.portrait],
    ["Name", done.name],
    ["Core Prompts", done.corePrompts],
    ["Greeting", done.greeting],
    ["Tags", done.tags],
    ["Lens Check", lensClean],
  ] as const;
  const doneCount = chips.filter(([, ok]) => ok).length;

  const saveQueue = useRef(new EditorSaveQueue());
  const saveInFlight = useRef(false);
  useEffect(() => () => { saveQueue.current.invalidate(); }, []);
  const doSave = useCallback(async (intent: SaveIntent = "manual"): Promise<boolean> => {
    if (saveInFlight.current) return false;
    saveInFlight.current = true;
    try {
    return (await saveQueue.current.run(async (isCurrent) => {
    if (!isCurrent()) return false;
    const acceptedEditEpoch = editEpoch.current;
    const namedGeneration = named.editGeneration.current;
    const capturedNamedUploads = [...namedUploads.current];
    const submittedFormats = new Set([...new Set([...targets, ...Object.keys(originalDraft), ...Object.keys(nativeBaseline.current)])].filter((format) => mutation.current!.hasTouchOverlapping(`original:${format}`)));
    const submission = mutation.current!.beginSubmit(acceptedEditEpoch);
    const namedRefs = new Set(namedUploads.current.map((upload) => upload.ref));
    const ordinaryMediaUploads = referencedAssetUploads({ body: baseDraft, original: originalDraft }, mediaUploads).filter((upload) => !namedRefs.has(upload.ref));
    const unusedMediaUploads = mediaUploads.filter((upload) => !ordinaryMediaUploads.some((used) => used.ref === upload.ref) && !namedRefs.has(upload.ref));
    let saved = false;
    try { saved = await runEditorSave({
      saving,
      dirty,
      baseDraft,
      originalDraft,
      order,
      initEnt: init.ent,
      hadOrder: init.hadOrder,
      setSaving,
      setBaseline,
      setNativeBaseline: (savedOriginal) => {
        nativeBaseline.current = acceptedNativeBaseline(savedOriginal, nativeBaseline.current, submittedFormats);
      },
      setBaseDraft: setBaseDraftRaw,
      setOriginalDraft: setOriginalDraftRaw,
      orderBaselineRef,
      expectedRevision: revisionRef.current,
      isCurrent,
      saveEntity: (entity, expectedRevision, saveIntent) => saveCharacterPatch({
        entity,
        expectedRevision,
        intent: saveIntent,
        initEntity: init.ent,
        baselineBody: baseline,
        nativeBaseline: nativeBaseline.current,
        namedRows: mutation.current!.hasTouch("original:risu:namedAssets") ? rowsOfNamed(mediaBundle(baseDraft, originalDraft, targets).namedBag) : null,
        acceptedRows: namedBaselineRows.current,
        uploads: capturedNamedUploads,
        mediaUploads: ordinaryMediaUploads,
        recoverNamed: async (refs) => {
          const { grants } = await transferAssets(refs);
          capturedNamedUploads.push(...grants);
          namedUploads.current = [...new Map([...namedUploads.current, ...grants].map((grant) => [grant.ref, grant])).values()];
          return grants;
        },
        id: piece.id,
        isCurrent,
        patch: (kind, id, revision, patch, uploads, intentValue) => ctx.api.patchEditedEntity(kind, id, revision, patch, uploads, intentValue),
        onAccepted: (revision, rows, remaining) => {
          revisionRef.current = revision;
          named.accept(rows, remaining, capturedNamedUploads, namedGeneration);
          const pending = new Set(remaining.map((upload) => upload.ref));
          acceptMediaUploads(capturedNamedUploads.filter((upload) => !pending.has(upload.ref)).map((upload) => upload.ref));
        },
        onAcceptedMedia: (revision, remaining) => {
          revisionRef.current = revision;
          const pending = new Set(remaining.map((upload) => upload.ref));
          const consumed = ordinaryMediaUploads.filter((upload) => !pending.has(upload.ref)).map((upload) => upload.ref);
          acceptMediaUploads(consumed);
        },
      }),
      setRevision: (next) => {
        revisionRef.current = next;
      },
      setStatus: (msg) => ctx.setStatus(msg),
      onAccepted: (body, original) => {
        const acceptedOriginal = acceptedNativeBaseline(original, nativeBaseline.current, submittedFormats);
        const accepted = { body, original: acceptedOriginal };
        mutation.current!.accept(accepted, draftRef.current, acceptedEditEpoch);
        nativeBaseline.current = structuredClone(acceptedOriginal);
        setEdited(mutation.current!.dirty);
      },
    }, intent); }
    finally {
      submission(draftRef.current);
      if (isCurrent()) setEdited(mutation.current!.dirty);
    }
    if (isCurrent() && saved) void discardUnused([...unusedMediaUploads, ...capturedNamedUploads].map((upload) => upload.ref), draftRef.current,
      (grant) => mutation.current!.history.some((change) => referencedAssetUploads(change, [grant]).length > 0),
    ).then((refs) => { const removed = new Set(refs); namedUploads.current = namedUploads.current.filter((grant) => !removed.has(grant.ref)); });
    return isCurrent() && saved;
    }) ?? false);
    } finally { saveInFlight.current = false; }
  }, [ctx, dirty, baseDraft, originalDraft, init.ent, init.hadOrder, order, saving, baseline, named, namedUploads, namedBaselineRows, piece.id, mediaUploads, acceptMediaUploads, discardUnused, transferAssets, targets]);

  // savable: a card with no name cannot be saved at all, so autosave must not try and then report
  // a failure - "this may have changed on disk" is a false alarm when the name field is just empty.
  useEditorGuards(ctx, piece, dirty, doSave, str(readPath(baseDraft, "identity.name")).trim().length > 0);
  useCharacterHistory(mutation.current, draftRef, piece.id, markEdited, setBaseDraftRaw, setOriginalDraftRaw, ctx.setStatus, named.noteEdit);

  // completion reports in the STATUS BAR (passive status does not rent space in a control row);
  // only what is MISSING is worth words
  const missingChips = chips.filter(([, ok]) => !ok).map(([label]) => label.toLowerCase()).join(" · ");
  useEffect(() => {
    ctx.setStatus(missingChips === "" ? `${doneCount}/${chips.length} · piece complete` : `${doneCount}/${chips.length} · needs ${missingChips}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneCount, missingChips]);

  const { mediaCaps, spritePack, spriteCount, namedBag: nativeNamedBag, namedCount } = mediaBundle(
    baseDraft,
    originalDraft,
    targets,
  );
  const namedBag = nativeNamedBag;
  const artUrl = resolveArtUrl({
    draft,
    varyActiveId: vary.activeId,
    piece,
  });
  const applyNamed = (value: NonNullable<typeof namedProjection>, grants: typeof mediaUploads): void => {
    const unused = applyNamedAssets(value, grants);
    setOriginalDraft((original) => originalWithNamed(original, value), risuNamedTouch);
    if (unused.length) void discardUploads(unused);
  };
  const applySpritePack = (pack: SpritePackValue, groups?: Record<string, SpritePackValue>): void => {
    setBaseDraft((d) => bodyWithPack(d, pack));
    setOriginalDraft((o) => originalWithPack(o, pack, groups));
  };
  const applyFaceOnly = (pack: SpritePackValue, wantLabel?: string | null): void => {
    const { body, pack: empty } = bodyWithFaceOnly(baseDraft, pack, wantLabel);
    setBaseDraft(body);
    setOriginalDraft((o) => originalWithPack(o, empty));
  };

  const knowledgeRefs = ((): string[] => {
    const raw = readPath(baseDraft, "knowledgeRefs");
    return strArray(raw);
  })();

  const leftCard = (
    <EditorLeftCard
      artUrl={artUrl}
      draft={draft}
      piece={piece}
      vary={vary}
      styles={styles}
      setField={setField}
      uploadAsset={uploadAsset}
      mediaCaps={mediaCaps}
      spriteCount={spriteCount}
      namedCount={namedCount}
      setSpritesOpen={setSpritesOpen}
      setSpritesFocusLabel={setSpritesFocusLabel}
      setNamedOpen={(open) => {
        if (!open) { setNamedOpen(false); return; }
        if (named.readState !== "available") {
          ctx.setStatus("Card assets are unavailable; retrying the saved projection.");
          void named.load();
          return;
        }
        setNamedOpen(true);
      }}
      ctx={ctx}
      knowledgeRefs={knowledgeRefs}
      onKnowledgeRefsChange={(next) => setField("knowledgeRefs", next.length ? next : "")}
    />
  );

  const bodyViews = buildEditorBodyViews({
    draft,
    setField,
    styles,
    leftCard,
    vary,
    coverage,
    targets,
    offTarget,
    artAccent,
    flowIndex,
    setFlowIndex,
    saving,
    doSave,
    quizRef,
    activeCardRef,
    splitPct,
    onSplitDown,
    artUrl,
    piece,
    originalDraft,
    setNative,
    setNativeStub,
    mediaSprites: mediaCaps.sprites,
    setSpritesOpen,
    initOriginalKeys: Object.keys(recOr(init.ent.original)).length ? Object.keys(recOr(init.ent.original)) : piece.sourceFormat ? [piece.sourceFormat] : [],
    platformLabel,
    ctx,
    uploadAsset,
    text,
  });
  return (
    <CharacterEditorView
      ctx={ctx} piece={piece} topRight={topRight}
      prefs={{ targets, toggleTarget, clearTargets, offTarget, pickOffTarget, editorScale, setEditorScale, stepScale, editorLayout, setEditorLayout, mode, setMode, onboarded, scaleMin, scaleMax }}
      bodyViews={bodyViews} coverage={coverage} platformLabel={platformLabel} chips={chips}
      nativeStub={nativeStub} setNativeStub={setNativeStub} workshop={workshop} setWorkshop={setWorkshop}
      saving={saving} dirty={dirty} doSave={doSave} openExport={() => void openExport()}
      exportOpen={exportOpen} setExportOpen={setExportOpen} exportEntity={exportEntity}
      spritesOpen={spritesOpen} setSpritesOpen={setSpritesOpen} spritesFocusLabel={spritesFocusLabel}
      setSpritesFocusLabel={setSpritesFocusLabel} namedOpen={namedOpen} setNamedOpen={setNamedOpen}
      baseDraft={baseDraft} originalDraft={originalDraft} name={text("identity.name") || piece.name}
      version={text("identity.characterVersion")} initEnt={init.ent} mediaCaps={mediaCaps} spritePack={spritePack}
      namedBag={namedBag} targets={targets} packCatalog={packCatalog} applyFaceOnly={applyFaceOnly}
      applySpritePack={applySpritePack} applyNamed={applyNamed} uploadNamedAsset={stageAsset} uploadAsset={uploadAsset}
      uploadBatch={uploadBatch} stagedUploads={mediaUploads} discardUploads={discardUploads} pinUploads={pinUploads} unpinUploads={unpinUploads}
      transferAssets={transferAssets} acceptUploads={acceptMediaUploads}
    />
  );
}
