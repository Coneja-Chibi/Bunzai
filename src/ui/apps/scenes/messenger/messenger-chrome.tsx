/**
 * The Messenger layout (RoleCall DiscordChrome.tsx, approved wireframe rc-port/messenger.html views 2-5): a rail with one button per program, a sidebar (Browse Characters,
 * recent characters, active features, the persona and the gear), the conversation header and the portrait, around the scene's own chat (`children`, the same transcript and composer
 * the Full Chat layout draws). A program opens as a tab in place of the chat or as a dialog with the section list; the programs visited stay mounted (hidden and inert) so their
 * drafts survive, and so does the chat. Under 640px the left side is a drawer behind a menu button; under 1024px the portrait moves into the header corner (messenger-style.ts, drawn by messenger.tsx).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, type JSX, type ReactNode } from "react";
import type { AppContext } from "../../../app-contract";
import { handOffScene } from "../../../_shared/scene-handoff";
import { Ic } from "../../../_shared/ic";
import type { OpenScene } from "../../../../studio/scenes";
import { ZoomArt } from "../scene-portrait-zoom";
import { Avatar, Rail, Sidebar, SceneAvatar } from "./messenger-parts";
import type { Program } from "./programs";
import { useRecentCharacters } from "./use-recent-characters";
import { useMessengerFocus, useNarrow } from "./use-messenger-focus";
import { useMessengerNav, type MessengerRequest } from "./use-messenger-nav";

export interface MessengerChromeProps {
  ctx: AppContext;
  chatId: string;
  /** The open scene; absent while it loads, which leaves the shell without programs. */
  scene: OpenScene | null;
  name: string;
  personaName: string;
  programs: readonly Program[];
  request: MessengerRequest | null;
  /** The header's own controls: the takes pill and the Update available badge (they live in the Full Chat header). */
  actions: ReactNode;
  onBack(): void;
  /** Whether a program is open over the chat, so the page can leave its chat shortcuts alone. */
  onSurface(open: boolean): void;
  renderProgram(program: Program): ReactNode;
  children: ReactNode;
}

export function MessengerChrome({ ctx, chatId, scene, name, personaName, programs, request, actions, onBack, onSurface, renderProgram, children }: MessengerChromeProps): JSX.Element {
  const shell = useRef<HTMLDivElement>(null);
  const left = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  const nav = useMessengerNav(programs, request);
  const { selected, selectedId, overlayOpen, tabOpen, navOpen, setNavOpen } = nav;
  const surface = selected !== undefined;
  useEffect(() => { onSurface(surface); return () => onSurface(false); }, [onSurface, surface]);
  const narrow = useNarrow(shell);
  const focus = useMessengerFocus({ left, dialog, menu, overlayOpen, tabOpen, navOpen, narrow, closeSettings: nav.closeSettings, setNavOpen });
  const { recents, retry } = useRecentCharacters(ctx.api);
  const persona = programs.find((p) => p.id === "persona");
  const characters = programs.find((p) => p.id === "characters");
  const characterId = scene?.chat.cast.character.id ?? "";
  const regexCount = scene?.chat.regex?.sets?.length ?? 0;
  const activities = useMemo(() => [
    ...programs.filter((p) => p.panel).map((p) => ({ id: p.id, title: p.title, programId: p.id })),
    ...(regexCount > 0 && programs.some((p) => p.id === "regex") ? [{ id: "regex", title: `Regex (${regexCount})`, programId: "regex" }] : []),
  ], [programs, regexCount]);
  // Behind a dialog or the drawer the floating pop-out panels cannot be reached (RoleCall makes the scene's other floating controls inert, DiscordChrome.tsx:193-203).
  useLayoutEffect(() => {
    if (!overlayOpen && !navOpen) return undefined;
    const layers = [...(shell.current?.closest(".scs")?.querySelectorAll<HTMLElement>(".po-layer") ?? [])];
    const was = layers.map((l) => l.hasAttribute("inert"));
    layers.forEach((l) => l.setAttribute("inert", ""));
    return () => layers.forEach((l, i) => { if (!was[i]) l.removeAttribute("inert"); });
  }, [overlayOpen, navOpen]);
  const open = (id: string, view: "tab" | "modal" = "tab"): void => {
    if (view === "modal") focus.remember();
    nav.open(id, view);
  };
  const avatar = scene ? <SceneAvatar ctx={ctx} scene={{ ...scene.chat, characterName: name, hasPortrait: scene.hasPortrait }} /> : <Avatar name={name} />;
  return (
    <div ref={shell} className="msn" data-has-portrait={scene?.hasPortrait === true} data-nav-open={navOpen}>
      <div className="msn-bg" inert={overlayOpen}>
        {navOpen && <button type="button" className="msn-backdrop" aria-label="Close recent characters" onClick={focus.closeNav} />}
        <div ref={left} className="msn-left">
          <Rail programs={programs} openId={tabOpen ? nav.tabId : null} onChat={nav.showChat} onOpen={(id) => open(id)} />
          <Sidebar ctx={ctx} recents={recents} activities={activities} hasCharacters={characters !== undefined} canSettings={programs.length > 0}
            current={{ characterId, name, avatar }} persona={{ name: personaName, canOpen: persona !== undefined }}
            onClose={focus.closeNav} onChat={nav.showChat} onBrowse={() => characters && open(characters.id)} onRetry={retry} onActivity={(id) => open(id)}
            onPick={(s) => { nav.showChat(); if (s.id !== chatId) handOffScene(s.id); }}
            onProfile={() => persona && open(persona.id, "modal")}
            onSettings={() => { const first = programs.find((p) => p.id !== persona?.id) ?? programs[0]; if (first) open(first.id, "modal"); }} />
        </div>
        <header className="msn-head" inert={navOpen}>
          <button ref={menu} type="button" className="msn-mmenu" aria-label="Show recent characters" aria-expanded={navOpen} onClick={() => setNavOpen(!navOpen)}><Ic name="lucide:menu" /></button>
          <button type="button" className="msn-back" aria-label="Back to Scenes" title="Back to Scenes" onClick={onBack}><Ic name="lucide:arrow-left" /></button>
          {avatar}
          <div><strong>{name}</strong><small>Character conversation</small></div>
          <div className="msn-actions sh">{actions}</div>
        </header>
        {scene?.hasPortrait && (
          <aside className="msn-portrait" aria-label="Character portrait" inert={navOpen}>
            <ZoomArt ctx={ctx} chatId={chatId} characterId={characterId} snapshotVersion={scene.chat.snapshotVersion} hasArt name={name} />
            <div><strong>{name}</strong><small>Character portrait</small></div>
          </aside>
        )}
      </div>
      <div className="msn-chat" role="region" aria-label="Conversation" data-msn-chat="" hidden={tabOpen} inert={tabOpen || overlayOpen || navOpen}>{children}</div>
      <div className="msn-sb" data-view={overlayOpen ? "modal" : "tab"} hidden={!surface} onClick={(e) => { if (overlayOpen && e.target === e.currentTarget) nav.closeSettings(); }}>
        <div ref={dialog} className="msn-set" role={overlayOpen ? "dialog" : "region"} aria-modal={overlayOpen ? true : undefined} tabIndex={-1} inert={!surface}
          aria-label={overlayOpen ? (selected?.id === persona?.id ? "My Profile" : "Scene settings") : selected?.title ?? "Feature workspace"}>
          <nav className="msn-snav" hidden={!overlayOpen} aria-label="Scene settings sections">
            <span className="msn-cap">YOUR PROFILE</span>
            {persona && <button type="button" aria-current={selectedId === persona.id ? "page" : undefined} onClick={() => open(persona.id, "modal")}>My Profile</button>}
            <span className="msn-cap">SCENE SETTINGS</span>
            {programs.filter((p) => p.id !== persona?.id).map((p) => <button key={p.id} type="button" aria-current={selectedId === p.id ? "page" : undefined} onClick={() => open(p.id, "modal")}>{p.title}</button>)}
          </nav>
          <section className="msn-scont">
            <header>
              <div><span>{overlayOpen ? "BUNRAKU SETTINGS" : "FEATURE WORKSPACE"}</span><h2>{selected?.id === persona?.id ? "My Profile" : selected?.title}</h2></div>
              <button type="button" data-msn-close="" className="msn-x" aria-label={overlayOpen ? "Close settings" : "Back to chat"} onClick={overlayOpen ? nav.closeSettings : nav.showChat}><Ic name="lucide:x" />{overlayOpen && <small>ESC</small>}</button>
            </header>
            <div className="msn-outlets">
              {nav.visited.map((id) => {
                const p = programs.find((q) => q.id === id);
                return p ? <div key={id} className="msn-prog" data-program={id} hidden={selectedId !== id} inert={selectedId !== id}>{renderProgram(p)}</div> : null;
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
