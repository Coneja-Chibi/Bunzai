/** Sealed install, approval, effective-resolution and revocation owner for theme packages. */
import type { StateStore } from "../stage/contracts/state-store";
import { classifyRisk } from "../kit/tools/safety/risk";
import { decideGate } from "../kit/tools/safety/gate-core";
import { toErrorMessage } from "../error-message";
import { differenceScore } from "./theme-difference";
import { inspectThemePackage, themeFileBody, type EffectiveThemeAppearance, type ThemePackageInput, type ThemePackagePreview, type ThemeScope } from "./theme-contract";

interface Entry { input: ThemePackageInput; digest: string; scopes: ThemeScope[]; enabled: boolean; host: boolean }
interface Document { version: 1; entries: Record<string, Entry>; audit: { at: number; id: string; action: string; digest: string }[]; boot?: { attempts: number } }
interface Challenge { input: ThemePackageInput; digest: string; expires: number; kind: "install" | "restore"; id: string }
/** `difference` is the share of surfaces where the theme picks a variant no other listed theme picks; `swatch` is its palette's base, panel, text, brand, action, select and ok colors for the manager's mini preview. */
export interface ThemeCatalogEntry { id: string; name: string; version: string; digest: string; builtIn: boolean; enabled: boolean; updateAvailable?: boolean; requestedScopes: ThemeScope[]; grantedScopes: ThemeScope[]; difference: number; swatch: string[]; /** Why a stored package no longer passes checks; the row stays listed, disabled and ungranted, so it can be removed or installed again. */ invalid?: string; /** Set on every entry when the saved theme state cannot be read; only bundled themes are listed, none enabled. */ stateError?: string }
const swatchOf = (p: ThemePackagePreview): string[] => { const { surface, text, roles } = p.appearance.palette; return [surface.base, surface.panel, text.text, roles.brand.fill, roles.action.fill, roles.select.fill, roles.ok.fill]; };
const STATE_ERROR = "The saved theme state could not be read.";
const boundedReason = (error: unknown): string => toErrorMessage(error, "The package failed inspection.").slice(0, 200);
const MAX_STATE = 1_800_000;
/** Launches in a row that served a styled theme and never reached a healthy page, before the styled themes are switched off. */
const CRASH_LOOP_LIMIT = 3;
const hasModScope = (scopes: readonly string[]): boolean => scopes.some((s) => s === "appearance.styles" || s === "appearance.fonts" || s === "ui.slots");
export interface ThemeLifecycleOptions { /** Launch flag: every theme resolves to core through the disabled path; nothing is changed or revoked. */ safeMode?: boolean }
const core = (reason?: EffectiveThemeAppearance["fallbackReason"]): EffectiveThemeAppearance => ({
  themeId: null, packageId: null, digest: null, grantedScopes: [], appearance: null, assets: [], fonts: [], styles: null, slots: {},
  ...(reason ? { fallbackReason: reason } : {}),
});
const ordered = (items: readonly string[]): string[] => [...items].sort();
const same = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && ordered(a).every((v, i) => v === ordered(b)[i]);
function parseDocument(text: string | null): Document {
  if (text === null) return { version: 1, entries: {}, audit: [] };
  if (new TextEncoder().encode(text).byteLength > MAX_STATE) throw new Error("theme state over limit");
  const doc = JSON.parse(text) as Document;
  if (!doc || doc.version !== 1 || !doc.entries || typeof doc.entries !== "object" || Array.isArray(doc.entries) || !Array.isArray(doc.audit) || doc.audit.length > 100) throw new Error("invalid theme state");
  if (doc.boot !== undefined && (!doc.boot || typeof doc.boot.attempts !== "number" || !Number.isInteger(doc.boot.attempts) || doc.boot.attempts < 0 || doc.boot.attempts > 1000)) throw new Error("invalid theme state");
  for (const [id, row] of Object.entries(doc.entries)) {
    if (!row || typeof row !== "object" || typeof row.enabled !== "boolean" || typeof row.host !== "boolean" || !Array.isArray(row.scopes) || typeof row.digest !== "string" || !row.input || typeof row.input !== "object") throw new Error("invalid theme state");
    if ((row.input.manifest as { id?: unknown })?.id !== id) throw new Error("theme state identity mismatch");
  }
  return doc;
}
function append(doc: Document, id: string, action: string, digest: string): void {
  doc.audit.push({ at: Date.now(), id, action, digest });
  if (doc.audit.length > 100) doc.audit.splice(0, doc.audit.length - 100);
}

export async function createThemeLifecycle(state: StateStore, bundledInputs: readonly ThemePackageInput[], examples: readonly ThemePackageInput[] = [], options: ThemeLifecycleOptions = {}) {
  const bundled = new Map<string, { input: ThemePackageInput; preview: ThemePackagePreview }>();
  for (const input of bundledInputs) {
    const id = ((input.manifest as { id?: unknown })?.id);
    if (typeof id !== "string" || bundled.has(id)) throw new Error("duplicate bundled theme id");
    bundled.set(id, { input, preview: await inspectThemePackage(input, id) });
  }
  const examplesById = new Map<string, { input: ThemePackageInput; preview: ThemePackagePreview }>();
  for (const input of examples) {
    const p = await inspectThemePackage(input);
    if (bundled.has(p.id) || examplesById.has(p.id)) throw new Error("theme example identity collision");
    examplesById.set(p.id, { input, preview: p });
  }
  const challenges = new Map<string, Challenge>();
  const listeners = new Set<(revision: number) => void>();
  const epoch = challengeToken();
  let revision = 0;
  const changed = (): void => {
    revision++;
    for (const listener of listeners) { try { listener(revision); } catch { /* one listener cannot block a committed mutation */ } }
  };
  let mutationTail: Promise<void> = Promise.resolve();
  const serialize = <T>(work: () => Promise<T>): Promise<T> => {
    const result = mutationTail.then(work, work);
    mutationTail = result.then(() => undefined, () => undefined);
    return result;
  };
  const read = async (): Promise<Document> => parseDocument(await state.read("themeExtensions"));
  const write = async (doc: Document): Promise<void> => {
    const text = JSON.stringify(doc);
    if (new TextEncoder().encode(text).byteLength > MAX_STATE) throw new Error("theme state over limit");
    await state.write("themeExtensions", text);
  };
  const preview = async (input: ThemePackageInput): Promise<ThemePackagePreview> => inspectThemePackage(input);
  const resolve = async (themeId: string | null | undefined): Promise<EffectiveThemeAppearance> => {
    if (typeof themeId !== "string") return core("not-installed");
    let doc: Document;
    try { doc = await read(); } catch { return core("invalid-state"); }
    const builtIn = bundled.get(themeId);
    const row = doc.entries[themeId];
    if (builtIn) {
      if (row && !row.host) return core("invalid-state");
      if (row && row.digest !== builtIn.preview.digest) return core(row.scopes.length ? "disabled" : "revoked");
      if (row && !row.enabled) return core(row.scopes.length ? "disabled" : "revoked");
      return response(themeId, builtIn.preview, builtIn.preview.derivedScopes);
    }
    if (!row || row.host) return core("not-installed");
    if (!row.enabled) return core(row.scopes.length ? "disabled" : "revoked");
    if (row.scopes.length === 0) return core("revoked");
    try {
      const checked = await preview(row.input);
      if (checked.digest !== row.digest || !same(row.scopes, checked.derivedScopes)) return core("invalid-state");
      return response(themeId, checked, row.scopes);
    } catch { return core("invalid-state"); }
  };
  let bootArmed = false;
  /** Count this launch once it serves a styled theme. After CRASH_LOOP_LIMIT unhealthy launches, every styled theme is disabled (not revoked or removed). True when this launch tripped. */
  const armBoot = (): Promise<boolean> => {
    if (bootArmed) return Promise.resolve(false);
    bootArmed = true;
    return serialize(async () => {
      const doc = await read();
      const attempts = doc.boot?.attempts ?? 0;
      if (attempts < CRASH_LOOP_LIMIT) { doc.boot = { attempts: attempts + 1 }; await write(doc); return false; }
      for (const [id, item] of bundled) if (hasModScope(item.preview.derivedScopes) && !doc.entries[id]) {
        doc.entries[id] = { input: item.input, digest: item.preview.digest, scopes: item.preview.derivedScopes, enabled: false, host: true };
        append(doc, id, "crash-loop", item.preview.digest);
      }
      for (const [id, row] of Object.entries(doc.entries)) if (row.enabled && hasModScope(row.scopes)) { row.enabled = false; append(doc, id, "crash-loop", row.digest); }
      doc.boot = { attempts: 0 };
      await write(doc);
      changed();
      return true;
    });
  };
  const effective = async (themeId: string | null | undefined): Promise<EffectiveThemeAppearance> => {
    if (options.safeMode) return core("disabled");
    const out = await resolve(themeId);
    if (out.themeId === null || (out.styles === null && Object.keys(out.slots).length === 0)) return out;
    return await armBoot() ? core("disabled") : out;
  };
  const confirmHealthy = (): Promise<void> => serialize(async () => {
    const doc = await read();
    if (!doc.boot || doc.boot.attempts === 0) return;
    doc.boot = { attempts: 0 };
    await write(doc);
  });
  function response(themeId: string, p: ThemePackagePreview, grantedScopes: ThemeScope[]): EffectiveThemeAppearance {
    const url = (id: string): string => "/api/themes/assets/" + encodeURIComponent(p.id) + "/" + encodeURIComponent(id) + "?digest=" + p.digest;
    return { themeId, name: p.name, packageId: p.id, digest: p.digest, grantedScopes, appearance: p.appearance, styles: p.styles, slots: p.slots,
      assets: p.assets.map((a) => ({ id: a.id, digest: a.digest, url: url(a.id), mediaType: a.mediaType })),
      fonts: p.fonts.map((f) => ({ id: f.id, digest: f.digest, url: url(f.id), mediaType: f.mediaType })) };
  }
  const inspect = async (input: ThemePackageInput): Promise<{ preview: ThemePackagePreview; challenge: string }> => {
    const p = await preview(input);
    if (bundled.has(p.id)) throw new Error("reserved host theme id");
    const verdict = classifyRisk("write", undefined, "theme-extension.install");
    if (decideGate("theme-extension.install", verdict, { mode: "guarded", grants: new Set() }) !== "confirm") throw new Error("install confirmation required");
    const challenge = challengeToken();
    const snapshot = JSON.parse(JSON.stringify(input)) as ThemePackageInput;
    challenges.set(challenge, { input: snapshot, digest: p.digest, expires: Date.now() + 300_000, kind: "install", id: p.id });
    while (challenges.size > 12) challenges.delete(challenges.keys().next().value!);
    return { preview: p, challenge };
  };
  const inspectExample = async (id: string): Promise<{ preview: ThemePackagePreview; challenge: string }> => {
    const item = examplesById.get(id);
    if (!item) throw new Error("theme example not found");
    return inspect(item.input);
  };
  const exportExample = (id: string): ThemePackageInput => {
    const item = examplesById.get(id);
    if (!item) throw new Error("theme example not found");
    return JSON.parse(JSON.stringify(item.input)) as ThemePackageInput;
  };
  const inspectRestore = async (id: string): Promise<{ id: string; name: string; digest: string; challenge: string }> => {
    const item = bundled.get(id);
    if (!item) throw new Error("host theme not found");
    const challenge = challengeToken();
    challenges.set(challenge, { input: item.input, digest: item.preview.digest, expires: Date.now() + 300_000, kind: "restore", id });
    while (challenges.size > 12) challenges.delete(challenges.keys().next().value!);
    return { id, name: item.preview.name, digest: item.preview.digest, challenge };
  };
  const install = async (challenge: unknown, digest: unknown, decision: unknown): Promise<ThemeCatalogEntry | { denied: true }> => {
    if (typeof challenge !== "string" || typeof digest !== "string") throw new Error("digest-bound user confirmation required");
    const pending = challenges.get(challenge);
    challenges.delete(challenge);
    if (!pending || pending.kind !== "install" || pending.expires < Date.now() || pending.digest !== digest) throw new Error("approval expired or package changed");
    if (decision !== "approve" && decision !== "deny") throw new Error("explicit approval or denial required");
    if (decision === "deny") {
      return serialize(async () => {
        const doc = await read(); append(doc, pending.id, "install-denied", pending.digest); await write(doc);
        return { denied: true as const };
      });
    }
    return serialize(async () => {
      const p = await preview(pending.input);
      if (p.digest !== pending.digest || bundled.has(p.id)) throw new Error("approval expired or package changed");
      const doc = await read();
      doc.entries[p.id] = { input: pending.input, digest: p.digest, scopes: p.derivedScopes, enabled: true, host: false };
      append(doc, p.id, "install-approved", p.digest);
      await write(doc);
      changed();
      return (await list()).find((entry) => entry.id === p.id)!;
    });
  };
  const restore = async (id: string, challenge: unknown, digest: unknown, decision: unknown): Promise<void> => {
    if (typeof challenge !== "string" || typeof digest !== "string") throw new Error("digest-bound user confirmation required");
    const pending = challenges.get(challenge);
    challenges.delete(challenge);
    if (!pending || pending.kind !== "restore" || pending.id !== id || pending.expires < Date.now() || pending.digest !== digest) throw new Error("approval expired or host theme changed");
    if (decision !== "approve") return serialize(async () => {
      const doc = await read(); append(doc, id, "restore-denied", digest); await write(doc);
      throw new Error("theme restore denied");
    });
    return serialize(async () => {
      const item = bundled.get(id);
      if (!item || item.preview.digest !== digest || pending.digest !== digest) throw new Error("host theme changed or is unavailable");
      const doc = await read(), row = doc.entries[id];
      if (row && (!row.host || (row.digest === digest && (row.enabled || row.scopes.length > 0)))) throw new Error("theme is not revoked or changed");
      doc.entries[id] = { input: item.input, digest, scopes: item.preview.derivedScopes, enabled: true, host: true };
      append(doc, id, "restore-approved", digest);
      await write(doc);
      changed();
    });
  };
  const mutate = async (id: string, action: "disable" | "enable" | "revoke" | "remove", audit: string = action): Promise<void> => {
    return serialize(async () => {
    const doc = await read();
    const builtIn = bundled.get(id), row = doc.entries[id];
    if (action === "remove" && !builtIn) {
      delete doc.entries[id];
      append(doc, id, audit, row?.digest ?? "");
    } else if (builtIn) {
      if (row && !row.host) throw new Error("host theme state mismatch");
      const stale = Boolean(row && row.digest !== builtIn.preview.digest);
      if (action === "enable" && row && (row.scopes.length === 0 || stale)) throw new Error("review the changed host theme before enabling");
      const revoked = action === "revoke" || Boolean(row && row.scopes.length === 0);
      const digest = stale ? row!.digest : builtIn.preview.digest;
      const scopes = revoked ? [] : stale ? row!.scopes : builtIn.preview.derivedScopes;
      doc.entries[id] = { input: stale ? row!.input : builtIn.input, digest, scopes, enabled: action === "enable", host: true };
      append(doc, id, audit, digest);
    } else {
      if (!row || row.host) throw new Error("theme is not installed");
      if (action === "enable") {
        const checked = await preview(row.input);
        if (!same(row.scopes, checked.derivedScopes)) throw new Error("fresh approval required after revocation");
        row.enabled = true;
      } else if (action === "revoke") { row.enabled = false; row.scopes = []; }
      else if (action === "disable") row.enabled = false;
      append(doc, id, audit, row.digest);
    }
    await write(doc);
    changed();
    });
  };
  const list = async (): Promise<ThemeCatalogEntry[]> => {
    let doc: Document, stateError: string | undefined;
    try { doc = await read(); } catch { doc = { version: 1, entries: {}, audit: [] }; stateError = STATE_ERROR; }
    const all = new Map<string, ThemeCatalogEntry>();
    const previews = new Map<string, ThemePackagePreview>();
    for (const [id, item] of bundled) {
      const row = doc.entries[id];
      const valid = !stateError && (!row || row.host);
      const updateAvailable = Boolean(row && row.host && row.digest !== item.preview.digest);
      previews.set(id, item.preview);
      all.set(id, { id, name: item.preview.name, version: item.preview.version, digest: item.preview.digest, builtIn: true, difference: 0, swatch: swatchOf(item.preview),
        enabled: valid && !updateAvailable && (!row || row.enabled), updateAvailable, requestedScopes: item.preview.requestedScopes, grantedScopes: valid ? (!row || row.enabled ? item.preview.derivedScopes : row.scopes) : [],
        ...(stateError ? { stateError } : {}) });
    }
    for (const [id, row] of Object.entries(doc.entries)) if (!row.host && !all.has(id)) {
      let p: ThemePackagePreview | null = null, invalid: string | undefined;
      try {
        p = await preview(row.input);
        if (p.digest !== row.digest) invalid = "The package no longer matches the version you approved.";
        else if (!same(row.scopes, p.derivedScopes) && !(!row.enabled && row.scopes.length === 0)) invalid = "The package's permissions no longer match what you approved.";
      } catch (error) { invalid = boundedReason(error); }
      if (invalid || !p) {
        const m = row.input.manifest as { name?: unknown; version?: unknown };
        all.set(id, { id, name: typeof m?.name === "string" ? m.name.slice(0, 80) : id, version: typeof m?.version === "string" ? m.version.slice(0, 40) : "", digest: row.digest, builtIn: false, difference: 0, swatch: [],
          enabled: false, requestedScopes: [], grantedScopes: [], invalid: invalid ?? "The package failed inspection." });
        continue;
      }
      previews.set(id, p);
      all.set(id, { id, name: p.name, version: p.version, digest: p.digest, builtIn: false, difference: 0, swatch: swatchOf(p), enabled: row.enabled, requestedScopes: p.requestedScopes, grantedScopes: row.scopes });
    }
    for (const [id, entry] of all) if (previews.has(id)) entry.difference = differenceScore(previews.get(id)!.appearance.surfaces, [...previews].filter(([other]) => other !== id).map(([, p]) => p.appearance.surfaces)).score;
    return [...all.values()].sort((a, b) => a.name.localeCompare(b.name));
  };
  const asset = async (themeId: string, assetId: string, digest: string): Promise<{ type: string; body: string | Uint8Array<ArrayBuffer> } | null> => {
    const active = await effective(themeId);
    if (active.digest !== digest) return null;
    const p = bundled.get(themeId)?.preview ?? await docAssetPreview(await read(), themeId);
    if (!p || p.digest !== digest) return null;
    const file = p.assets.find((a) => a.id === assetId) ?? p.fonts.find((f) => f.id === assetId);
    return file ? themeFileBody(file) : null;
  };
  /** A mod hid or covered a protected prompt: revoke it, so enabling again needs fresh approval. Only the digest that was painted can be marked. */
  const markBroken = async (id: string, digest: string): Promise<void> => {
    if ((await resolve(id)).digest !== digest) return;
    await mutate(id, "revoke", "broken");
  };
  return { markBroken, confirmHealthy, preview, inspect, inspectExample, exportExample, inspectRestore, install, deny: (challenge: unknown, digest: unknown) => install(challenge, digest, "deny"), restore, effective, list, asset,
    revision: () => revision, revisionStamp: () => ({ epoch, revision }),
    subscribe: (listener: (revision: number) => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    examples: () => [...examplesById.values()].map(({ preview: p }) => ({ id: p.id, name: p.name, version: p.version, digest: p.digest, requestedScopes: p.requestedScopes })),
    disable: (id: string) => mutate(id, "disable"), enable: (id: string) => mutate(id, "enable"),
    revoke: (id: string) => mutate(id, "revoke"), remove: (id: string) => mutate(id, "remove") };
  async function docAssetPreview(doc: Document, id: string): Promise<ThemePackagePreview | null> {
    const row = doc.entries[id];
    if (!row) return null;
    try { return await preview(row.input); } catch { return null; }
  }
}

function challengeToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
}
