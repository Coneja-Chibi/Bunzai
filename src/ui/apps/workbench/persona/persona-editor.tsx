/**
 * PersonaEditor (P4 v2) - the persona sheet: its sections and rail are declared once and EditorLayout
 * arranges them per editor.frame (core = the CHARACTER editor's bento chassis, the kinship ruling). Core: left = sticky face + linked lorebook; middle = Identity + the section tiles +
 * flat Identity Text; right = Color Palette + Prompt Injection + LIVE preview (the real
 * inject.ts output + the shared token convention) + the default star. Save preserves the sealed
 * `original` so imported personas round-trip byte-true.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type JSX, type ReactNode } from "react";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import { toErrorMessage } from "../../../_shared/error-message";
import { useAccentVars } from "../../../_shared/use-scoped-accents";
import { portraitUrl as storedPortraitUrl } from "../../../_shared/asset-url";
import { useArtSrc, usePieceArtIdentity, usePortraitAsset } from "../../../_shared/art-cache";
import type { PersonaBody } from "../../../../entities/persona/schema";
import { EditorSaveQueue, useEditorHistoryKeys, useEditorRevision, type EditorTouch } from "../../../_shared/editor-state";
import { buildPiecePatch } from "../../../_shared/editor-patch";
import { parseCanonicalEntity, type ParsedCanonicalEntity } from "../../../../entities/runtime-schema";
import type { SaveIntent } from "../../../../stage/contracts/content-store";
import { referencedAssetUploads, useAssetUploads } from "../../../_shared/asset-upload";
import {
  injectPersonaXml,
  injectionsForProfile,
  parseWriteFor,
  PERSONA_INJECTION_LABELS,
  PERSONA_WRITE_FOR_LABELS,
  PERSONA_WRITE_FOR_PROFILES,
  platformOwnsField,
  type PersonaWriteForProfile,
} from "../../../../core/persona";
import { MobileEditorHead, type MobileMenuItem } from "../../../components/mobile-editor-head";
import { WriteForStrip } from "../../../components/write-for-strip";
import { EditorEhead } from "../../../components/editor-ehead";
import { PortraitCard } from "../controls/portrait-card";
import { KnowledgeRail } from "../lore/KnowledgeRail";
import es from "../editor-styles";
import { InjectionCard } from "./injection-card";
import { EditorLayout } from "../layout/editor-layout";
import type { EditorSection } from "../layout/editor-layout-core";
import {
  ContentCard,
  IdentityCard,
  PaletteCard,
  PreviewCard,
  SectionCard,
} from "./persona-cards";
import { draftPortraitRef, setPortrait } from "./session";
import s from "./persona.module.css";
import { useEditorGuards } from "../use-editor-guards";
import { isRecord, recOr } from "../../../../core/guards";
import { DEFAULT_PERSONA_PREF } from "../../../../studio/scenes";
import { roughTokenCount } from "../../../../core/tokens/estimate";

export interface PersonaEditorViewProps {
  entity: unknown;
  revision: string;
  ctx: AppContext;
  piece: StudioEntitySummary;
  topRight?: ReactNode;
}

const WRITE_FOR_PREF = "persona.writeFor";

function canonicalPersona(entity: unknown, id: string): Extract<ParsedCanonicalEntity, { kind: "persona" }> {
  const parsed = parseCanonicalEntity(entity);
  if (parsed.kind !== "persona" || parsed.id !== id) throw new Error("Persona editor received a mismatched entity");
  return parsed;
}


function bodyFromEntity(entity: unknown): PersonaBody {
  const e = recOr(entity);
  const b = isRecord(e.body) ? (e.body as unknown as PersonaBody) : null;
  if (b && typeof b.name === "string" && typeof b.content === "string") return structuredClone(b);
  return { name: "Untitled persona", content: "" };
}

export function PersonaEditorView({ entity, revision, ctx, piece, topRight }: PersonaEditorViewProps): JSX.Element {
  const accentVars = useAccentVars();
  const revisionRef = useRef(revision);
  const initialEntity = useMemo(() => canonicalPersona(entity, piece.id), [entity, piece.id]);
  const baselineEntity = useRef(initialEntity);
  const saveQueue = useRef(new EditorSaveQueue());
  useEffect(() => () => { saveQueue.current.invalidate(); }, []);
  const initBody = useMemo(() => bodyFromEntity(entity), [entity]);
  const { body, dirty, edit: editBody, captureRevision, releaseSubmission, commit, canUndo, canRedo, undo, redo } =
    useEditorRevision(initBody, { kind: "persona", id: piece.id });
  const bodyRef = useRef(body);
  bodyRef.current = body;
  const [saving, setSaving] = useState(false);
  const { uploads, uploadAsset, accept, discardUnused } = useAssetUploads(
    ctx.api.uploadAsset,
    ctx.api.discardAssetUploads,
    (error) => ctx.setStatus(toErrorMessage(error, "could not stage portrait")),
  );
  const [writeFor, setWriteForState] = useState<PersonaWriteForProfile>(() =>
    parseWriteFor(ctx.prefs.get(WRITE_FOR_PREF)),
  );
  const [defaultId, setDefaultId] = useState<string>(() => String(ctx.prefs.get(DEFAULT_PERSONA_PREF) ?? ""));

  const xml = useMemo(() => injectPersonaXml(body), [body]);
  const tokens = roughTokenCount(xml); // the lore estimator's convention (chars/4)
  const stops = injectionsForProfile(writeFor);

  const setWriteFor = (p: PersonaWriteForProfile): void => {
    setWriteForState(p);
    ctx.prefs.set(WRITE_FOR_PREF, p);
  };

  const toggleDefault = (): void => {
    const next = defaultId === piece.id ? "" : piece.id;
    setDefaultId(next);
    ctx.prefs.set(DEFAULT_PERSONA_PREF, next);
    ctx.setStatus(next ? `${body.name || "this persona"} is the default now` : "default persona cleared");
  };

  const doSave = useCallback(async (intent: SaveIntent = "manual"): Promise<boolean> => {
    if (saving || !dirty) return true;
    if (!body.name.trim()) {
      ctx.setStatus("a name is required before saving");
      return false;
    }
    const submitted = body;
    const submittedUploads = referencedAssetUploads(submitted, uploads);
    const unusedUploads = uploads.filter((upload) => !submittedUploads.some((used) => used.ref === upload.ref));
    const atRev = captureRevision();
    const result = await saveQueue.current.run(async (isCurrent) => {
      setSaving(true);
      try {
        const next = { ...baselineEntity.current, body: submitted };
        const patch = buildPiecePatch(baselineEntity.current, next);
        const saved = await ctx.api.patchEditedEntity("persona", piece.id, revisionRef.current, patch, submittedUploads.map((upload) => upload.ref), intent);
        if (!isCurrent()) return false;
        baselineEntity.current = next;
        revisionRef.current = saved.revision;
        commit(submitted, atRev);
        accept(submittedUploads.map((upload) => upload.ref));
        if (unusedUploads.length) void discardUnused(unusedUploads.map((upload) => upload.ref), bodyRef.current);
        ctx.setStatus(`saved persona · ${submitted.name}`);
        return true;
      } catch (e) {
        if (isCurrent()) ctx.setStatus(toErrorMessage(e, "could not save the persona"));
        return false;
      } finally {
        if (isCurrent()) setSaving(false);
      }
    }).finally(() => releaseSubmission(atRev));
    return result ?? false;
  }, [saving, dirty, body, ctx, piece.id, captureRevision, releaseSubmission, commit, uploads, accept, discardUnused]);

  // savable: a piece with no name cannot be saved at all, so autosave must not try and then report
  // a failure - "this may have changed on disk" is a false alarm when the name field is just empty.
  useEditorGuards(ctx, piece, dirty, doSave, body.name.trim().length > 0);
  useEditorHistoryKeys(canUndo, canRedo, () => { undo(); }, () => { redo(); }, ctx.setStatus, "persona");

  const mobileMenu: MobileMenuItem[] = PERSONA_WRITE_FOR_PROFILES.map((p) => ({
    label: `${writeFor === p ? "● " : "○ "}Writing for: ${PERSONA_WRITE_FOR_LABELS[p]}`,
    onPick: () => setWriteFor(p),
  }));

  const monogram = (body.name.trim().charAt(0) || "P").toUpperCase();
  // the character editor's resolution order: a displayable draft ref wins (an asset sentinel included), else the studio API
  const draftPortrait = draftPortraitRef(body);
  const draftArt = useArtSrc(draftPortrait);
  const artIdentity = usePieceArtIdentity(ctx.pieces, "persona", piece.id, piece.writeId ?? 0, piece.revision ?? "");
  const storedArt = usePortraitAsset("persona", piece.id, piece.version, !draftPortrait && piece.hasPortrait ? storedPortraitUrl("persona", piece.id) : null, artIdentity);
  const portraitUrl = draftPortrait ? draftArt.src ?? null : storedArt.src ?? null;
  const portraitRef = draftPortrait ? draftArt.ref : storedArt.ref;
  const onBody = useCallback((update: (body: PersonaBody) => PersonaBody, key: keyof PersonaBody): void => {
    const touch: EditorTouch<PersonaBody> = {
      key,
      read: (value) => value[key],
      write: (value, next) => ({ ...value, [key]: next }),
    };
    editBody(update, touch);
  }, [editBody]);

  const text = (key: "appearance" | "body" | "personality" | "quirks" | "history", title: string, placeholder: string): EditorSection => ({
    id: key, title, filled: ((body.sections ?? {})[key] ?? "").trim() !== "",
    node: <SectionCard body={body} onBody={onBody} writeFor={writeFor} sectionKey={key} title={title} placeholder={placeholder} />,
  });
  const colors = body.presentation?.colors ?? [];
  const injectionStop = PERSONA_INJECTION_LABELS[body.chatInjection?.position ?? "character"]?.label ?? "Character";
  const rail = (
    <>
      <PortraitCard
        artUrl={portraitUrl}
        artRef={portraitRef}
        name={body.name || "Untitled persona"}
        tokens={tokens}
        updatedAt={null}
        styles={es}
        showSprites={false}
        onPortraitChange={(portrait) => onBody((b) => setPortrait(b, portrait), "media")}
        uploadAsset={uploadAsset}
      />
      <KnowledgeRail
        ctx={ctx}
        refs={body.knowledgeRefs ?? []}
        onChange={(next) => onBody((b) => ({ ...b, knowledgeRefs: next.length ? next : undefined }), "knowledgeRefs")}
      />
    </>
  );
  const sections: EditorSection[] = [
    { id: "identity", title: "Identity", filled: !!(body.identity?.tagline || body.identity?.pronouns || body.brief), node: <IdentityCard body={body} onBody={onBody} /> },
    ...(platformOwnsField(writeFor, "sections") ? [
      text("appearance", "Appearance", "Build, features, style..."),
      text("body", "Body", "Physical details (folds into Appearance in the prompt)..."),
      text("personality", "Personality", "How they act, their demeanor..."),
      text("quirks", "Quirks", "Habits, mannerisms, speech..."),
      text("history", "History", "Background, origins..."),
    ] : []),
    { id: "content", title: "Identity Text", filled: body.content.trim() !== "", node: <ContentCard body={body} onBody={onBody} writeFor={writeFor} /> },
    ...(platformOwnsField(writeFor, "colors") ? [{ id: "palette", title: "Color Palette", column: 2 as const, filled: colors.length > 0 || !!body.presentation?.signatureColor, node: <PaletteCard body={body} onBody={onBody} /> }] : []),
    ...(stops.length > 0 && platformOwnsField(writeFor, "injection") ? [{
      id: "injection", title: "Prompt Injection", column: 2 as const, filled: true,
      node: <InjectionCard body={body} onBody={onBody} stops={stops} labels={PERSONA_INJECTION_LABELS} showWrapper={platformOwnsField(writeFor, "wrapper")} lens />,
    }] : []),
    { id: "preview", title: "Live Preview", column: 2, filled: true, node: <PreviewCard xml={xml} tokens={tokens} stopLabel={injectionStop} /> },
    {
      id: "default", title: "Default Persona", column: 2,
      node: (
        <button type="button" className={defaultId === piece.id ? `${s.defaultBtn} ${s.defaultOn}` : s.defaultBtn} aria-pressed={defaultId === piece.id} onClick={toggleDefault}>
          {defaultId === piece.id ? "★ Default persona" : "☆ Set as default persona"}
        </button>
      ),
    },
  ];

  return (
    <div className={s.root} style={accentVars(piece.accent) as CSSProperties | undefined}>
      <div className={s.mHeadGate}>
        <MobileEditorHead
          name={body.name || "Untitled persona"}
          sub={`persona · ${saving ? "saving…" : dirty ? "unsaved changes" : "saved"}`}
          dirty={dirty}
          saving={saving}
          onBack={() => ctx.workbench.remove(piece.id, piece.kind)}
          onSave={() => void doSave()}
          menu={mobileMenu}
        />
      </div>

      <EditorEhead
        mark={monogram}
        name={body.name}
          onNameChange={(v) => onBody((b) => ({ ...b, name: v }), "name")}
        namePlaceholder="Untitled persona"
        nameAriaLabel="Persona name"
        meta={`persona · ${dirty ? "unsaved" : "saved"}`}
        dirty={dirty}
        saving={saving}
        onSave={() => void doSave()}
        topRight={topRight}
      >
        <WriteForStrip
          profiles={PERSONA_WRITE_FOR_PROFILES}
          labels={PERSONA_WRITE_FOR_LABELS}
          value={writeFor}
          onChange={setWriteFor}
        />
      </EditorEhead>

      <div className={s.body}>
        <EditorLayout label="Persona sections" rail={rail} sections={sections} />
      </div>
    </div>
  );
}
