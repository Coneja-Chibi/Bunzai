/**
 * The scene's model choice (ChatStore rule 18), read and written in one place for the AI wing and the
 * Control Booth: Kit's saved connections, each one's models from Kit's discovery (read once and kept by
 * model-list-cache.ts; a connection whose list fails still offers the model saved on it), the studio's
 * favourites, and the scene's pick. Picking is one at a time: a second click while one saves is
 * dropped, so the last click is the last write.
 */
import { useEffect, useRef, useState } from "react";
import type { AppContext } from "../../app-contract";
import type { SceneConnectionInfo } from "../../app-contract-scenes";
import { toErrorMessage } from "../../_shared/error-message";
import type { Chat, ChatConnection } from "../../../stage/contracts/chat-store";
import { strArray } from "../../../core/guards";
import { readModels, type Models } from "./model-list-cache";

const FAVORITES = "scenes.favoriteModels";

export type { Models };

/** How a stated context window reads after a model's name: " · 200k context", or nothing when none is stated. */
export const contextOf = (n?: number) => (n ? ` · ${n >= 1_000_000 ? `${Math.floor(n / 100_000) / 10}M` : `${Math.floor(n / 1000)}k`} context` : "");

export const keyOf = (c: ChatConnection) => `${c.id}|${c.model}`;

export interface SceneModels {
  /** Kit's connections; null until they are read. */
  conns: SceneConnectionInfo[] | null;
  models: Record<string, Models>;
  favorites: string[];
  labelOf(id: string): string;
  /** The context window the connection states for a model; undefined when it states none (or has not been read). */
  windowOf(c: ChatConnection): number | undefined;
  /** The model's display name when its connection's list gave one (RoleCall shows names, not ids), else its id. */
  nameOf(c: ChatConnection): string;
  toggleFavorite(key: string): void;
  /** Asks the connection for its list again, after a failed read. */
  retry(id: string): void;
  pick(c: ChatConnection): void;
}

export function useSceneModels(ctx: AppContext, chat: Chat, onPicked: (chat: Chat) => void): SceneModels {
  const [conns, setConns] = useState<SceneConnectionInfo[] | null>(null);
  const [models, setModels] = useState<Record<string, Models>>({});
  const [favorites, setFavorites] = useState<string[]>(() => strArray(ctx.prefs.get(FAVORITES)));
  const live = useRef(true);

  const load = (c: SceneConnectionInfo, force: boolean): void => {
    setModels((m) => ({ ...m, [c.id]: { state: "loading" } }));
    void readModels(ctx, c.id, c.model, force).then((r) => { if (live.current) setModels((m) => ({ ...m, [c.id]: r })); });
  };
  useEffect(() => {
    live.current = true;
    ctx.api.sceneConnections().then((list) => {
      if (!live.current) return;
      setConns(list);
      for (const c of list) if (!c.unavailable) load(c, false);
    }, (e: unknown) => live.current && ctx.setStatus(`could not list connections: ${toErrorMessage(e)}`));
    return () => { live.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `load` only closes over ctx
  }, [ctx]);

  const picking = useRef(false);
  const pick = (c: ChatConnection): void => {
    if (picking.current) return;
    picking.current = true;
    ctx.api.setSceneConnection(chat.id, c)
      .then(onPicked, (e: unknown) => ctx.setStatus(`could not pick that model: ${toErrorMessage(e)}`))
      .finally(() => { picking.current = false; });
  };
  const toggleFavorite = (key: string): void => {
    const next = favorites.includes(key) ? favorites.filter((k) => k !== key) : [...favorites, key];
    setFavorites(next);
    ctx.prefs.set(FAVORITES, next);
  };
  const windowOf = (c: ChatConnection): number | undefined => {
    const m = models[c.id];
    return m?.state === "ready" ? m.ids.find((x) => x.id === c.model)?.context : undefined;
  };
  const nameOf = (c: ChatConnection): string => {
    const m = models[c.id];
    return (m?.state === "ready" ? m.ids.find((x) => x.id === c.model)?.label : undefined) ?? c.model;
  };
  const retry = (id: string): void => { const c = conns?.find((x) => x.id === id); if (c) load(c, true); };
  return { conns, models, favorites, labelOf: (id) => conns?.find((c) => c.id === id)?.label ?? "a connection Kit no longer has", windowOf, nameOf, toggleFavorite, retry, pick };
}

/** Every model a scene can pick right now, as select choices keyed like `keyOf` (unusable connections left out; a failed list still offers its saved model). */
export function modelChoices(models: SceneModels): { value: string; label: string; conn: ChatConnection }[] {
  return (models.conns ?? []).flatMap((c) => {
    if (c.unavailable) return [];
    const m = models.models[c.id];
    const ids: { id: string; label?: string }[] = m?.state === "ready" ? m.ids : m?.state === "failed" ? [{ id: m.saved }] : [];
    return ids.map((x) => { const conn = { id: c.id, model: x.id }; return { value: keyOf(conn), label: `${c.label}: ${x.label ?? x.id}`, conn }; });
  });
}
