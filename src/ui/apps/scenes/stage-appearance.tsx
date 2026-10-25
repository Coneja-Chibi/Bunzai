/**
 * The Stage wing's Appearance tab: RoleCall's Stage settings panel (StageSettingsPanel.tsx:1540-2600). The hero, the pinned Chat Theme
 * cards and five collapsible acts: The Message, The Type, The Stage (the Backdrop row and the accent), Motion & Signals, Chrome & Device.
 * Every setting is a per-user preference (stage-look-core.ts is the one source of defaults, the keys and what each paints); the page
 * re-renders on a change, and each control saves the moment it is touched, so there is no Saving state to show (RoleCall never showed
 * its own, F5). Controls RoleCall draws that Bunraku leaves to the theme or has no reader for are listed in docs/reference/ui.md.
 */
import type { JSX } from "react";
import { Ic } from "../../_shared/ic";
import { useSurfaceVariant } from "../../_shared/surface-variant";
import { AccentRow } from "./scene-accent-row";
import { ACCENT_CUSTOM_KEY, ACCENT_SOURCE_KEY, accentSourceOf, sceneAccentHex, type PieceColors } from "./scene-accent-core";
import { Act } from "./stage-act";
import { ChromeAct } from "./stage-chrome-act";
import type { LookKey } from "./stage-controls";
import { ACTS, CHAT_THEMES, LOOK_KEYS, actStatus, closedActs, readLook, toggleAct, type ActId, type ChatTheme } from "./stage-look-core";
import { MessageAct } from "./stage-message-act";
import { MotionAct } from "./stage-motion-act";
import { TypeAct } from "./stage-type-act";

export interface AppearanceProps {
  prefs: { get(key: string): unknown };
  onSet(key: string, value: unknown): void;
  /** The scene's Backdrop row (scene-backdrop-wing.tsx); absent while no scene is open. */
  backdrop?: JSX.Element;
  /** Whether the scene shows a backdrop, for the closed Stage act's status. */
  backdropSet?: boolean;
  /** The cast's colours the accent row offers (scene-accents.ts sceneColors); absent while no scene is open. */
  colors?: PieceColors;
}

const THEMES: Record<ChatTheme, { name: string; hint: string }> = {
  basic: { name: "Basic", hint: "Just the chat and one settings button." },
  stage: { name: "Full Stage", hint: "Wings, tools, and production controls." },
  immersive: { name: "Immersive", hint: "Cinematic overlays, letterboxed." },
};
const TITLES: Record<ActId, string> = { message: "The Message", type: "The Type", stage: "The Stage", motion: "Motion & Signals", chrome: "Chrome & Device" };
/** A surface variant's name for the Message act's status ("chat-thread" reads "Chat thread"; no pick reads "Default"). */
const variantName = (v: string): string => (v === "core" ? "Default" : v.charAt(0).toUpperCase() + v.slice(1).replaceAll("-", " "));

export function StageAppearance({ prefs, onSet, backdrop, backdropSet, colors }: AppearanceProps): JSX.Element {
  const look = readLook(prefs);
  const closed = closedActs(prefs.get(LOOK_KEYS.acts));
  const message = useSurfaceVariant("scene.message");
  const layout = useSurfaceVariant("scene.layout");
  const set = (key: LookKey, value: unknown): void => onSet(LOOK_KEYS[key], value);
  const accent = (colors && (sceneAccentHex(accentSourceOf(prefs.get(ACCENT_SOURCE_KEY)), colors, prefs.get(ACCENT_CUSTOM_KEY)) ?? colors.character)) ?? "var(--bk-role-brand)";
  const act = { look, set, prefs, onSet };
  const bodies: Record<ActId, { status: string; body: JSX.Element | null }> = {
    message: { status: `${variantName(message)} · ${variantName(layout)}`, body: <MessageAct {...act} /> },
    type: { status: actStatus("type", look), body: <TypeAct {...act} accent={accent} /> },
    stage: { status: backdropSet ? "Background set" : "No background", body: backdrop || colors ? <>{backdrop}{colors && <AccentRow prefs={prefs} colors={colors} onSet={onSet} />}</> : null },
    motion: { status: actStatus("motion", look), body: <MotionAct {...act} /> },
    chrome: { status: actStatus("chrome", look), body: <ChromeAct {...act} /> },
  };
  return (
    <div className="wbody sa" data-part="scene.stage.appearance">
      <div className="pp-top">
        <header className="hero">
          <span className="hi"><Ic name="mdi:tune-vertical" size={20} /></span>
          <div><div className="eb">Scene presentation</div><h2>Appearance</h2>
            <p>Tune how the scene looks: message style, layout, typography, backgrounds, and accent colors for this chat.</p></div>
        </header>
      </div>
      <div className="sa-main">
      <div className="sa-field" data-part="scene.stage.theme">
        <span className="sa-lbl"><Ic name="lucide:panels-top-left" size={14} />Chat Theme</span>
        <div className="sa-cards" role="group" aria-label="Chat Theme">
          {CHAT_THEMES.map((id) => (
            <button type="button" key={id} className={`sa-card${look.chatTheme === id ? " on" : ""}`} aria-pressed={look.chatTheme === id} onClick={() => set("chatTheme", id)}>
              <b>{THEMES[id].name}</b><small>{THEMES[id].hint}</small>
            </button>
          ))}
        </div>
        <p className="sa-help">Theme changes the chrome, not the scene engine. Basic keeps only the AI and Stage wings; Full Stage restores every wing; Immersive is Full Stage with the house lights down.</p>
      </div>
      {ACTS.filter((id) => bodies[id].body).map((id) => (
        <Act key={id} id={id} title={TITLES[id]} status={bodies[id].status} open={!closed.has(id)} onToggle={() => onSet(LOOK_KEYS.acts, toggleAct(closed, id))}>{bodies[id].body}</Act>
      ))}
      </div>
    </div>
  );
}
