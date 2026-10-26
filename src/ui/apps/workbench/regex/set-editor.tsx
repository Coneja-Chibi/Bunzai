/**
 * SetEditor - the regex set-editor chassis (design/vs-regex-editor.html, 1:1): header with the spine
 * chip, the Write-for tab strip, and a state-honest Save; the toc | page | rail columns; the mobile
 * Contents sheet. Pure session ops (session.ts); save through the revision-checked Studio API, preserving the
 * sealed `original` so an imported set still round-trips byte-true. Exported as RegexSetEditor so the
 * workbench mount point re-exports it unchanged.
 */
import { Button, IconButton } from "../../../components/button";
import { Panel } from "../../../components/panel";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type ReactNode,
} from "react";
import type { AppContext, StudioEntitySummary } from "../../../app-contract";
import { applyEditorHistoryChange, applyPiecePatch, buildPiecePatch, buildTouchedPatch, deepEqual, editorHistoryChanges, EditorMutationLedger, OccurrenceIndex, useEditorHistoryKeys, useEditorSave, type EditorTouch } from "../../../_shared/editor-state";
import { partNames } from "../../../../entities/piece-parts";
import { useAccentVars } from "../../../_shared/use-scoped-accents";
import { toErrorMessage } from "../../../_shared/error-message";
import { CANONICAL_SCHEMA_VERSION } from "../../../../core/canonical";
import type { RegexRule, RegexSetBody } from "../../../../entities/regex/schema";
import type { ParsedCanonicalEntity } from "../../../../entities/runtime-schema";
import {
  findingsForRule,
  inspectSet,
  parseWriteFor,
  REGEX_WRITE_FOR_LABELS,
  REGEX_WRITE_FOR_PROFILES,
  slowRuleIds,
  type RegexFinding,
  type RegexWriteForProfile,
} from "../../../../core/regex";
import { BottomSheet } from "../../../components/bottom-sheet";
import { MobileEditorHead, type MobileMenuItem } from "../../../components/mobile-editor-head";
import { WriteForStrip } from "../../../components/write-for-strip";
import { EditorEhead } from "../../../components/editor-ehead";
import { regexStyles as styles } from "./regex-styles";
import { framed as f, useFramed, useRail } from "../framed";
import { EditorLayout } from "../layout/editor-layout";
import { RuleToc } from "./rule-toc";
import { RulePage } from "./rule-page";
import { RuleRail } from "./rule-rail";
import { BenchPane } from "./bench-pane";
import { HealthPane } from "./health-pane";
import { GalleryPane } from "./gallery-pane";
import { templateToRule } from "../../../../core/regex";
import {
  addRule,
  addRuleFrom,
  appendRules,
  bodyFromEntity,
  ruleTouch,
  stepRule,
  deleteRule,
  duplicateRule,
  focusedRule,
  normalizeSession,
  selectRule,
  updateRule,
  updateSet,
  type RegexSession,
} from "./session";
import { useEditorGuards } from "../use-editor-guards";
import { useReseedOnReread } from "../use-reseed";
import { EditorConflict } from "../editor-conflict";
import { apiStatusIs } from "../../../_shared/api-fetch";
import { recOr } from "../../../../core/guards";

export interface RegexSetEditorProps {
  entity: unknown;
  revision: string;
  ctx: AppContext;
  piece: StudioEntitySummary;
  topRight?: ReactNode;
}


const WRITE_FOR_PREF = "regex.writeFor";

export function RegexSetEditor({ entity, revision, ctx, piece, topRight }: RegexSetEditorProps): JSX.Element {
  const accentVars = useAccentVars();
  const framed = useFramed();
  const [section, setSection] = useState("rule"); // the open section under a theme frame
  const revisionRef = useRef(revision);
  const initBody = useMemo(() => bodyFromEntity(entity), [entity]);
  const [baseline, setBaseline] = useState(() => structuredClone(initBody));
  const baselineRef = useRef(baseline);
  baselineRef.current = baseline;
  const ledgerRef = useRef<EditorMutationLedger<RegexSetBody> | null>(null);
  ledgerRef.current ??= new EditorMutationLedger(initBody);
  const ledger = ledgerRef.current;
  const [dirty, setDirty] = useState(false);
  const [session, setSessionState] = useState<RegexSession>(() => normalizeSession(initBody));
  const ruleOccurrences = useRef(new OccurrenceIndex<RegexRule>());
  const ruleIndexReady = useRef(false);
  if (!ruleIndexReady.current) { ruleOccurrences.current.rebuild(initBody.rules, (item) => item.id); ruleIndexReady.current = true; }
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const editRevision = useRef(0);
  const setSession = useCallback((update: (current: RegexSession) => RegexSession, touch?: EditorTouch<RegexSetBody>, record = true, reconcile = false): void => {
    const current = sessionRef.current;
    let next = update(current);
    const changed = next.body !== current.body && (touch
      ? !deepEqual(touch.read(current.body), touch.read(next.body))
      : !deepEqual(current.body, next.body));
    if (next.body !== current.body) {
      editRevision.current++;
      if (changed) {
        ledger.track(next.body, touch, editRevision.current, reconcile);
        if (record) {
          const [inverse, forward] = editorHistoryChanges(current.body, next.body, touch, "regex", piece.id);
          ledger.history.record(inverse, forward);
        }
      }
      setDirty(ledger.dirty);
      if (!touch) ruleOccurrences.current.rebuild(next.body.rules, (item) => item.id);
    }
    sessionRef.current = next;
    setSessionState(next);
  }, [ledger, piece.id]);
  const [tocOpen, setTocOpen] = useState(false);
  const [benchOpen, setBenchOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [writeFor, setWriteForState] = useState<RegexWriteForProfile>(() =>
    parseWriteFor(ctx.prefs.get(WRITE_FOR_PREF)),
  );

  const canUndo = ledger.history.canUndo;
  const canRedo = ledger.history.canRedo;
  const undo = useCallback(() => {
    const change = ledger.history.undo();
    if (change) setSession((s) => ({ ...s, body: applyEditorHistoryChange(s.body, change, "regex", piece.id) }), change.touch, false, true);
  }, [ledger, piece.id, setSession]);
  const redo = useCallback(() => {
    const change = ledger.history.redo();
    if (change) setSession((s) => ({ ...s, body: applyEditorHistoryChange(s.body, change, "regex", piece.id) }), change.touch, false, true);
  }, [ledger, piece.id, setSession]);
  useEditorHistoryKeys(canUndo, canRedo, undo, redo, ctx.setStatus, "regex");
  const rule = focusedRule(session);
  const count = session.body.rules.length;
  const enabledCount = session.body.rules.filter((r) => r.enabled).length;
  const ruleIndex = rule ? session.body.rules.findIndex((r) => r.id === rule.id) : -1;

  // The set linter (R4): deferred so keystrokes stay snappy - the shadowing check runs the real
  // engine over each rule's examples, which is bounded but not free.
  const deferredBody = useDeferredValue(session.body);
  const findings = useMemo(() => inspectSet(deferredBody), [deferredBody]);
  const slowIds = useMemo(() => new Set(slowRuleIds(findings)), [findings]);

  const applyFix = (f: RegexFinding): void => {
    if (!f.fix) return;
    setSession((s) => ({ ...s, body: f.fix!(s.body) }));
    ctx.setStatus("fixed - save to keep");
  };

  const setWriteFor = (p: RegexWriteForProfile): void => {
    setWriteForState(p);
    ctx.prefs.set(WRITE_FOR_PREF, p);
  };

  const baseEntity = useMemo(() => {
    const source = recOr(entity);
    return { ...source, schemaVersion: CANONICAL_SCHEMA_VERSION, kind: "regex", id: piece.id, body: baseline } as ParsedCanonicalEntity;
  }, [entity, baseline, piece.id]);
  const saveState = useEditorSave({
    hasChanges: () => dirty,
    expectedRevision: () => revisionRef.current,
    read: async () => {
      const fresh = await ctx.api.getLightEditableEntity(`kind=regex&id=${encodeURIComponent(piece.id)}`);
      return { entity: fresh.entity as ParsedCanonicalEntity, revision: fresh.revision };
    },
    buildPatch: (base, submitted, _native, state) => {
      const next = { ...base, body: submitted } as ParsedCanonicalEntity;
      return state && !state.structural ? buildTouchedPatch(next, state.items) : buildPiecePatch(base, next);
    },
    itemNames: partNames,
    applyPatch: applyPiecePatch,
    patch: (expected, patch, intent) => ctx.api.patchEditedEntity("regex", piece.id, expected, patch, undefined, intent),
    capture: () => {
      const revision = editRevision.current;
      const release = ledger.beginSubmit(revision);
      const structural = ledger.structural;
      return { draft: sessionRef.current.body, baseline: baseEntity, revision, patchState: {
        get structural() {
          if (ledger.structural) release.promote();
          return structural || ledger.structural;
        }, items: ledger.partItems(sessionRef.current.body),
        overwrite: () => { ledger.markOverwrite(revision); setDirty(ledger.dirty); },
        release: () => {
          release(sessionRef.current.body);
          setDirty(ledger.dirty);
        },
      } };
    },
    commit: (submitted, atRev, savedRevisionValue) => {
      revisionRef.current = savedRevisionValue;
      setBaseline(submitted);
      baselineRef.current = submitted;
      ledger.accept(submitted, sessionRef.current.body, atRev);
      setDirty(ledger.dirty);
    },
    commitPartial: (saved, atRev, savedRevisionValue) => {
      revisionRef.current = savedRevisionValue;
      const submitted = bodyFromEntity(saved);
      setBaseline(submitted);
      baselineRef.current = submitted;
      ledger.accept(submitted, sessionRef.current.body, atRev);
      setDirty(ledger.dirty);
    },
    takeTheirs: (fresh, freshRevision) => {
      revisionRef.current = freshRevision;
      const nextBody = bodyFromEntity(fresh);
      const next = normalizeSession(nextBody);
      next.focusedId = sessionRef.current.focusedId;
      setBaseline(next.body);
      baselineRef.current = next.body;
      ledger.reseed(next.body);
      ruleOccurrences.current.rebuild(next.body.rules, (item) => item.id);
      setDirty(false);
      editRevision.current++;
      sessionRef.current = next;
      setSessionState(next);
    },
    isConflict: (error) => apiStatusIs(error, 409),
    onSave: (submitted, mode) => ctx.setStatus(`${mode === "keepMine" ? "overwrote" : "saved"} regex set · ${submitted.name}`),
    onError: (error) => ctx.setStatus(toErrorMessage(error, "save failed")),
  });
  const { saving, conflict, save, keepMine, takeTheirs, invalidate } = saveState;
  useReseedOnReread(revision, dirty, () => {
    invalidate();
    revisionRef.current = revision;
    const fresh = bodyFromEntity(entity);
    setBaseline(fresh);
    baselineRef.current = fresh;
    ledger.reseed(fresh);
    ruleOccurrences.current.rebuild(fresh.rules, (item) => item.id);
    setDirty(false);
    const next = normalizeSession(fresh);
    sessionRef.current = next;
    setSessionState(next);
  });

  const flip = (dir: -1 | 1): void => setSession((s) => stepRule(s, dir));

  // Staged import from the test bench: nothing is written until the user saves.
  const appendImported = (staged: RegexRule[]): void => {
    if (staged.length === 0) return;
    setSession((s) => appendRules(s, staged));
    ctx.setStatus(`added ${staged.length} rule${staged.length === 1 ? "" : "s"} from import - save to keep`);
  };

  const doSave = useCallback(async (intent: "manual" | "autosave" = "manual"): Promise<boolean> => {
    if (!dirty) return true;
    if (!session.body.name.trim()) {
      ctx.setStatus("a name is required before saving");
      return false;
    }
    return save(intent);
  }, [dirty, session.body.name, ctx, save]);

  // savable: a piece with no name cannot be saved at all, so autosave must not try and then report
  // a failure - "this may have changed on disk" is a false alarm when the name field is just empty.
  useEditorGuards(ctx, piece, dirty, doSave, session.body.name.trim().length > 0, saveState.autosave);

  useEffect(() => {
    ctx.setStatus(`${count} rule${count === 1 ? "" : "s"} · ${enabledCount} on`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, enabledCount]);

  const monogram = (session.body.name.trim().charAt(0) || "R").toUpperCase();
  const tocProps = {
    rules: session.body.rules,
    focusedId: session.focusedId,
    styles,
    onSelect: (id: string) => {
      setSession((s) => selectRule(s, id));
      setSection("rule");
    },
    onAdd: () => {
      setSection("rule");
      setBenchOpen(false);
      setHealthOpen(false);
      setGalleryOpen(true);
    },
    slowIds,
  };

  // Mobile head kebab (below 34rem the desktop Write-for strip yields to this menu): every profile is
  // a picker row, the active one marked ● in the house on/off idiom - the phase picker's lens honesty
  // stays reachable on the phone.
  const mobileMenu: MobileMenuItem[] = REGEX_WRITE_FOR_PROFILES.map((p) => ({
    label: `${writeFor === p ? "● " : "○ "}Writing for: ${REGEX_WRITE_FOR_LABELS[p]}`,
    onPick: () => setWriteFor(p),
  }));

  const pageNode = (
    <>
      {!rule ? (
        <div className={styles.empty}>
          This set has no rules yet. Add one from the list to start authoring.
        </div>
      ) : (
        <RulePage
          key={rule.id}
          rule={rule}
          rules={session.body.rules}
          writeFor={writeFor}
          index={ruleIndex}
          count={count}
          styles={styles}
          onPrev={() => flip(-1)}
          onNext={() => flip(1)}
          onPatch={(patch) => setSession((s) => updateRule(s, rule.id, patch), ruleTouch(rule.id, ruleOccurrences.current))}
          onDuplicate={() => setSession((s) => duplicateRule(s, rule.id))}
          onDelete={() => {
            setSession((s) => deleteRule(s, rule.id));
            ctx.setStatus(`deleted "${rule.label.trim() || "the rule"}" - save to keep`);
          }}
        />
      )}
    </>
  );
  /** the gallery, bench or health pane: it takes the rail in core and the page area in a theme frame */
  const auxNode = galleryOpen || benchOpen || healthOpen ? (
    <>
      {galleryOpen ? (
        <GalleryPane
          onPick={(entry) => {
            setSession((s) => addRuleFrom(s, (id, sortOrder) => templateToRule(entry, id, sortOrder)));
            setGalleryOpen(false);
            ctx.setStatus(`added "${entry.name}" - save to keep`);
          }}
          onStartBlank={() => {
            setSession((s) => addRule(s));
            setGalleryOpen(false);
          }}
          onClose={() => setGalleryOpen(false)}
        />
      ) : benchOpen ? (
        <BenchPane
          ctx={ctx}
          rules={session.body.rules}
          onClose={() => setBenchOpen(false)}
          onImportPicked={appendImported}
        />
      ) : healthOpen ? (
        <HealthPane
          findings={findings}
          rules={session.body.rules}
          onClose={() => setHealthOpen(false)}
          onGoTo={(id) => setSession((s) => selectRule(s, id))}
          onFix={applyFix}
        />
      ) : null}
    </>
  ) : null;
  const ruleRail = rule && (
    <RuleRail
      rule={rule}
      styles={styles}
      findings={findingsForRule(findings, rule.id)}
      onOpenBench={() => {
        setSection("rule");
        setHealthOpen(false);
        setBenchOpen(true);
      }}
      onOpenHealth={() => {
        setSection("rule");
        setBenchOpen(false);
        setHealthOpen(true);
      }}
    />
  );
  const railNode = auxNode ?? ruleRail;
  // document-like frames carry the tools and panes as the last section; the others keep the rail and give a pane the page area
  const tools = useRail(railNode, "Tools");
  const inTail = tools.tail.length > 0;
  const paneInPage = !inTail && auxNode !== null;

  return (
    <div className={styles.root} style={accentVars(piece.accent) as CSSProperties | undefined}>
      {/* mobile head: below 34rem the desktop header hides and this thumb-sized back / name / save /
          kebab takes over (design/vs-regex-shelf-gallery wire 3, the registry MobileEditorHead) */}
      <div className={styles.mHeadGate}>
        <MobileEditorHead
          name={session.body.name || "Untitled regex set"}
          sub={`regex set · ${saving ? "saving…" : dirty ? "unsaved changes" : "saved"}`}
          dirty={dirty}
          saving={saving}
          onBack={() => ctx.workbench.remove(piece.id, piece.kind)}
          onSave={() => void doSave()}
          menu={mobileMenu}
        />
      </div>

      {/* header: the shared EditorEhead + the write-for strip */}
      <EditorEhead
        mark={monogram}
        kind="Regex set"
        deck="regex"
        name={session.body.name}
        onNameChange={(v) => setSession((s) => updateSet(s, { name: v }), {
          key: "name", read: (body) => body.name, write: (body, value) => ({ ...body, name: value as string }),
        })}
        namePlaceholder="Untitled regex set"
        nameAriaLabel="Set name"
        meta={`${count} rule${count === 1 ? "" : "s"} · ${enabledCount} on · regex set`}
        dirty={dirty}
        saving={saving}
        onSave={() => void doSave()}
        topRight={topRight}
      >
        <WriteForStrip
          profiles={REGEX_WRITE_FOR_PROFILES}
          labels={REGEX_WRITE_FOR_LABELS}
          value={writeFor}
          onChange={setWriteFor}
        />
      </EditorEhead>
      {conflict && <EditorConflict what="regex set" onTakeTheirs={() => void takeTheirs()} onKeepMine={() => void keepMine()} />}

      {framed ? (
        <div className={f.host}>
          <EditorLayout label="Regex sections" rail={inTail ? undefined : ruleRail} active={section} onActiveChange={setSection} sections={[
            { id: "contents", title: "Rules", filled: count > 0, node: <div className={f.bounded}><RuleToc {...tocProps} /></div> },
            { id: "rule", title: "Rule", filled: rule !== null, node: <><div hidden={paneInPage}>{pageNode}</div>{paneInPage && auxNode}</> },
            ...tools.tail]} />
        </div>
      ) : (
        <>
        {/* mobile contents bar: the TOC leaves the flow below 34rem. Hidden while the bench is open so
            the full-screen takeover (page hidden at 34rem) isn't steered by a pager for an invisible
            page (design/vs-regex-shelf-gallery wire 3, bench frame carries no Contents/pager bar). */}
        {!benchOpen && (
        <div className={styles.mBar}>
          <Button size="sm" onClick={() => setTocOpen(true)}>&#9776; Rules</Button>
          <span className={styles.mPageNo}>{rule ? `${ruleIndex + 1} / ${count}` : "empty"}</span>
          <IconButton label="Previous rule" size="sm" icon="lucide:chevron-left" disabled={!rule || ruleIndex <= 0} onClick={() => flip(-1)} />
          <IconButton label="Next rule" size="sm" icon="lucide:chevron-right" disabled={!rule || ruleIndex >= count - 1} onClick={() => flip(1)} />
        </div>
        )}

        {/* toc | page | rail (or the wide test bench beside a slim editor) */}
        <Panel as="div" deck="regex" data-part="regex.workspace" className={benchOpen || healthOpen || galleryOpen ? `${styles.cols} ${styles.colsBench}` : styles.cols}>
          <div className={styles.tocCol}>
            <RuleToc {...tocProps} />
          </div>

          <main className={styles.pageCol}>
            {pageNode}
          </main>

          <div className={styles.railCol}>
            {railNode}
          </div>
        </Panel>

        {/* mobile contents sheet: same TOC, docked to the pane bottom */}
        {tocOpen && (
          <div className={styles.mGate}>
            <BottomSheet title="Rules" onDismiss={() => setTocOpen(false)}>
              <RuleToc
                {...tocProps}
                onSelect={(id) => {
                  tocProps.onSelect(id);
                  setTocOpen(false);
                }}
              />
            </BottomSheet>
          </div>
        )}
        </>
      )}
    </div>
  );
}
