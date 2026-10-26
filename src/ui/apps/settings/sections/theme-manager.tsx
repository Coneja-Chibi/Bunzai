/** Permissioned theme-package manager; packages are inert descriptors, never styles or code. */
import { useCallback, useEffect, useState } from "react";
import type { JSX } from "react";
import type { AppContext } from "../../../app-contract";
import { toErrorMessage } from "../../../../error-message";
import { apiFetchJson } from "../../../_shared/api-fetch";
import { DEFAULT_STUDIO_THEME, SETTING_KEYS } from "../../../../studio/settings-shape";
import type { ThemePackagePreview } from "../../../../extensions/theme-contract";
import type { ThemeCatalogEntry } from "../../../../extensions/theme-lifecycle";
import { Button } from "../../../components/button";
import styles from "./theme-manager.module.css";

interface Inspection { preview: ThemePackagePreview; challenge: string }
interface Example { id: string; name: string; version: string; digest: string; requestedScopes: string[] }
interface RestoreReview { item: ThemeCatalogEntry; challenge: string }
const post = <T,>(path: string, body: Record<string, unknown>): Promise<T> =>
  apiFetchJson<T>(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const errorText = (error: unknown): string => toErrorMessage(error, "Theme request failed.");
const scopeLabels: Record<string, string> = {
  "appearance.palette": "Set the app colors (contrast is checked)", "appearance.type": "Choose host fonts and a text size step",
  "appearance.shape": "Set frame style, density and motion", "appearance.surfaces": "Choose host-built layouts for each screen",
  "appearance.accent": "Follow or ignore your accent color", "appearance.assets": "Display its own images (SVG, PNG, WebP)",
  "appearance.styles": "Restyle, hide, move or animate anything outside the lock and permission prompts", "appearance.fonts": "Load its own typefaces",
  "ui.slots": "Place its own images and text in named spots across the app",
};

export function ThemeManager({ ctx }: { ctx: AppContext }): JSX.Element {
  const requested = ctx.prefs.get(SETTING_KEYS.theme);
  const [catalog, setCatalog] = useState<ThemeCatalogEntry[]>([]);
  const [examples, setExamples] = useState<Example[]>([]);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [restoreReview, setRestoreReview] = useState<RestoreReview | null>(null);
  const [active, setActive] = useState(() => ctx.appearance.get());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const refresh = useCallback(async () => {
    try {
      setCatalog(await apiFetchJson<ThemeCatalogEntry[]>("/api/themes/packages"));
      try { setExamples(await apiFetchJson<Example[]>("/api/themes/examples")); }
      catch { setExamples([]); }
    }
    catch (error) { setNote(errorText(error)); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => ctx.appearance.onChange(() => setActive(ctx.appearance.get())), [ctx]);

  const choose = (value: string): void => {
    ctx.prefs.set(SETTING_KEYS.theme, value);
    setNote("Theme selection saved. It applies only when the host confirms its current permission.");
  };
  const inspectFile = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    setBusy(true); setNote(""); setInspection(null);
    try {
      if (file.size > 512_000) throw new Error("Theme package JSON must be no larger than 500 KB.");
      const input: unknown = JSON.parse(await file.text());
      const result = await post<Inspection>("/api/themes/inspect", input as Record<string, unknown>);
      setInspection(result);
      setNote("Review the exact package digest and requested appearance effects before approving.");
    } catch (error) { setNote(errorText(error)); }
    finally { setBusy(false); }
  };
  const inspectExample = async (id: string): Promise<void> => {
    setBusy(true); setNote(""); setInspection(null);
    try {
      setInspection(await post<Inspection>(`/api/themes/examples/${encodeURIComponent(id)}/inspect`, {}));
      setNote("Review the baked example's exact digest and derived appearance effects before approving.");
    } catch (error) { setNote(errorText(error)); }
    finally { setBusy(false); }
  };
  const downloadExample = async (id: string, name: string): Promise<void> => {
    setBusy(true); setNote("");
    try {
      const pack = await apiFetchJson<unknown>(`/api/themes/examples/${encodeURIComponent(id)}/package`);
      const url = URL.createObjectURL(new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = `${id}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNote(`${name} example envelope downloaded as JSON.`);
    } catch (error) { setNote(errorText(error)); }
    finally { setBusy(false); }
  };
  const approve = async (): Promise<void> => {
    if (!inspection) return;
    setBusy(true); setNote(""); ctx.appearance.invalidate();
    try {
      const installed = await post<ThemeCatalogEntry>("/api/themes/install", {
        challenge: inspection.challenge, digest: inspection.preview.digest, decision: "approve",
      });
      setInspection(null); ctx.appearance.invalidate(); await refresh(); await ctx.appearance.refresh();
      setNote(`${installed.name} installed with explicit approval. Select it above to apply.`);
    } catch (error) { setInspection(null); await ctx.appearance.refresh(); setNote(errorText(error)); }
    finally { setBusy(false); }
  };
  const deny = async (): Promise<void> => {
    if (!inspection) return;
    setBusy(true);
    try {
      await post<{ denied: boolean }>("/api/themes/deny", { challenge: inspection.challenge, digest: inspection.preview.digest });
      setInspection(null); setNote("Installation denied; the reviewed challenge was discarded and nothing was installed.");
    } catch (error) { setNote(errorText(error)); }
    finally { setBusy(false); }
  };
  const inspectRestore = async (item: ThemeCatalogEntry): Promise<void> => {
    setBusy(true); setNote(""); setRestoreReview(null);
    try {
      const receipt = await post<{ id: string; name: string; digest: string; challenge: string }>("/api/themes/restore/inspect", { id: item.id });
      if (receipt.digest !== item.digest) throw new Error("The bundled theme changed. Refresh the catalog and review it again.");
      setRestoreReview({ item, challenge: receipt.challenge });
    } catch (error) { setNote(errorText(error)); }
    finally { setBusy(false); }
  };
  const mutate = async (operation: "disable" | "enable" | "revoke" | "remove" | "restore", item: ThemeCatalogEntry): Promise<void> => {
    setBusy(true); setNote("");
    ctx.appearance.invalidate();
    try {
      await post(`/api/themes/${operation}`, {
        id: item.id,
        ...(operation === "restore" && restoreReview ? { challenge: restoreReview.challenge, digest: item.digest, decision: "approve" } : {}),
      });
      ctx.appearance.invalidate();
      await refresh();
      await ctx.appearance.refresh();
      setNote(`${item.name}: ${operation} completed. The effective appearance has been refreshed.`);
    } catch (error) { await ctx.appearance.refresh(); setNote(errorText(error)); }
    finally { setBusy(false); }
  };
  const options = catalog;
  const selected = typeof requested === "string" ? requested : DEFAULT_STUDIO_THEME;
  const selectedIsAvailable = options.some((item) => item.id === selected);

  return <section className={`${styles.manager} host-protected`} aria-labelledby="theme-manager-heading">
    <h3 id="theme-manager-heading">Theme packages</h3>
    <label className={styles.choice}>Requested appearance
      <select value={selectedIsAvailable ? selected : ""} onChange={(event) => choose(event.currentTarget.value)}>
        {!selectedIsAvailable && <option value="">Unavailable selection</option>}
        {options.map((item) => <option key={item.id} value={item.id}>{item.name}{item.builtIn ? " · bundled" : " · installed"}</option>)}
      </select>
    </label>
    <p className={styles.state} role="status">
      {active.themeId === selected ? `Effective: ${options.find((item) => item.id === active.themeId)?.name ?? active.themeId}.` : `Core appearance is active; requested theme is ${selected}.`}
      {active.fallbackReason ? ` ${active.fallbackReason.replaceAll("-", " ")}.` : ""}
    </p>
    <label className={styles.file}>Inspect a theme package JSON
      <input type="file" accept="application/json,.json" disabled={busy} onChange={(event) => void inspectFile(event.currentTarget.files?.[0])} />
    </label>
    {examples.filter((example) => !catalog.some((item) => item.id === example.id && item.enabled)).map((example) =>
      <div className={styles.example} key={example.id}>
        <div><strong>{example.name}</strong><span>Shipped example · not active</span></div>
        <div className={styles.actions}>
          <Button size="sm" disabled={busy} onClick={() => void inspectExample(example.id)}>Review example</Button>
          <Button size="sm" disabled={busy} onClick={() => void downloadExample(example.id, example.name)}>Download package</Button>
        </div>
      </div>)}
    <p className={styles.hint}>A package sets checked colors, fonts, shapes and screen layouts, and may add its own checked styles, fonts, images and slot content. It cannot run scripts, reach the network, or restyle this panel. Every power it uses is listed here for you to approve.</p>
    {inspection && <div className={styles.review} aria-label="Theme approval review">
      <h4>Review {inspection.preview.name} {inspection.preview.version}</h4>
      <code>{inspection.preview.id}</code>
      <code>SHA-256 · {inspection.preview.digest}</code>
      <ul>{inspection.preview.derivedScopes.map((scope) => <li key={scope}>{scopeLabels[scope] ?? scope}</li>)}</ul>
      <p>Approval applies to this exact digest. A changed package needs a new review and approval.</p>
      <div className={styles.actions}>
        <Button size="sm" variant="primary" disabled={busy} onClick={() => void approve()}>Approve and install</Button>
        <Button size="sm" variant="quiet" disabled={busy} onClick={() => void deny()}>Deny</Button>
      </div>
    </div>}
    {catalog[0]?.stateError && <p className={styles.state} role="status">{catalog[0].stateError} Installed themes are hidden until it is repaired.</p>}
    <ul className={styles.catalog} aria-label="Installed and bundled theme packages">
      {catalog.map((item) => <li key={item.id}>
        <div><strong>{item.name}</strong><span>{item.builtIn ? "Bundled" : "Imported"} · {item.enabled ? "enabled" : "disabled or revoked"}</span>
          <code>{item.invalid ? `This theme no longer passes checks: ${item.invalid.replace(/\.$/, "")}. Remove it or install it again.` : item.grantedScopes.length ? item.grantedScopes.join(" · ") : "No active grants"}</code></div>
        <div className={styles.actions}>
          {item.invalid ? examples.some((example) => example.id === item.id) && <Button size="sm" disabled={busy} onClick={() => void inspectExample(item.id)}>Reinstall</Button>
            : item.builtIn && (item.grantedScopes.length === 0 || item.updateAvailable)
            ? <Button size="sm" disabled={busy} onClick={() => void inspectRestore(item)}>{item.updateAvailable ? "Review host update" : "Review and restore"}</Button>
            : item.enabled || item.grantedScopes.length > 0
              ? <Button size="sm" disabled={busy} onClick={() => void mutate(item.enabled ? "disable" : "enable", item)}>{item.enabled ? "Disable" : "Enable"}</Button>
              : <span>Reinspect the package to request fresh grants.</span>}
          {!item.invalid && <Button size="sm" variant="danger" disabled={busy} onClick={() => void mutate("revoke", item)}>Revoke grants</Button>}
          {!item.builtIn && <Button size="sm" variant="danger" disabled={busy} onClick={() => void mutate("remove", item)}>Remove</Button>}
        </div>
      </li>)}
    </ul>
    {restoreReview && <div className={styles.review} aria-label="Built-in theme restore review">
      <h4>{restoreReview.item.updateAvailable ? "Review update for" : "Restore"} {restoreReview.item.name} {restoreReview.item.version}</h4>
      <code>{restoreReview.item.id}</code>
      <p>{restoreReview.item.updateAvailable
        ? "The host-verified package changed. Review its digest and grants before applying the update."
        : "This bundled appearance was revoked. Review the host-verified package digest and grants before restoring it."}</p>
      <code>SHA-256 · {restoreReview.item.digest}</code>
      <ul>{restoreReview.item.requestedScopes.map((scope) => <li key={scope}>{scopeLabels[scope] ?? scope}</li>)}</ul>
      <div className={styles.actions}>
        <Button size="sm" variant="primary" disabled={busy} onClick={() => void mutate("restore", restoreReview.item)}>Approve restore</Button>
        <Button size="sm" variant="quiet" disabled={busy} onClick={() => setRestoreReview(null)}>Cancel</Button>
      </div>
    </div>}
    {note && <p className={styles.state} role="status">{note}</p>}
  </section>;
}
