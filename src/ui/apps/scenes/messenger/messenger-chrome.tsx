/**
 * The Messenger layout (RoleCall DiscordChrome.tsx, approved wireframes messenger-discord/shell.html and panels.html): the rail of character tiles, the channel sidebar (this character's
 * scenes with their takes, the active features, the user panel), the conversation header with its panel switcher, the scene's own chat (`children`, the same transcript and composer the Full
 * Chat layout draws) and, on the right, either the open Side or Wide panel or the read-only member list. A program opens in the surface its kind names (shell/surfaces.ts): a docked panel, a
 * popout or a layer; the programs visited stay mounted in their own nodes (shell/program-holders.tsx) so their drafts survive every swap, and so does the chat. The gear and the character menu
 * open the scoped settings layer through `renderSettings`. Under 640px the left side is a drawer behind a menu button; under 1024px a docked panel covers the chat and the member list is a drawer.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type JSX, type ReactNode } from "react";
import type { AppContext } from "../../../app-contract";
import type { SceneLoreBook } from "../../../app-contract-scenes";
import { DIRECTOR_PROP_ID } from "../../../../core/director/settings";
import { handOffScene } from "../../../_shared/scene-handoff";
import { toErrorMessage } from "../../../_shared/error-message";
import { useEscapeKey } from "../../../_shared/use-escape-key";
import { Scrim } from "../../../components/button";
import type { Chat } from "../../../../stage/contracts/chat-store";
import { CharacterLibrary } from "../booth-navigator";
import { PopoutHost } from "../popout/popout-host";
import { wingBodyPopouts } from "../popout/wing-popouts";
import type { OpenScene } from "../../../../studio/scenes";
import type { PanelSpec } from "./frames/panel-switcher";
import { Avatar, SceneAvatar } from "./messenger-parts";
import type { Program } from "./programs";
import { Header } from "./shell/header";
import { Members } from "./shell/members";
import { ProgramPortals, ProgramSlot, useProgramHolders } from "./shell/program-holders";
import { unreadByCharacter, unreadByScene } from "./shell/read-marks";
import { Rail } from "./shell/rail";
import { Sidebar, type SidebarFeature } from "./shell/sidebar";
import { DockedSurface, FloatingSurface } from "./shell/surface-host";
import { hideCharacter, isDockedKind, isModalKind, KIND_LABEL, readHidden, readPins, surfaceOf, togglePin, WING_LABEL } from "./shell/surfaces";
import { topicLine } from "./shell/topic";
import { useLoreCount } from "./shell/use-lore-count";
import { useNotifyPrefs } from "./shell/use-notify-prefs";
import { useSceneManage } from "./shell/use-scene-manage";
import { useReadMarks } from "./shell/use-read-marks";
import type { SettingsScopeId } from "./settings/scopes";
import { forgetRecents, recentCharacters, scenesOfCharacter, useRecentCharacters } from "./use-recent-characters";
import { isCompact, isNarrow, useMessengerFocus, useSceneWidth } from "./use-messenger-focus";
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
  /** The lorebooks the page has loaded, or null before the Lorebooks wing has read them. */
  loreBooks: readonly SceneLoreBook[] | null;
  onBack(): void;
  /** Switches to a take of the open scene (the page's own take writer, the one the takes pill uses). */
  onTake(takeId: string): void;
  /** Whether a program or the settings layer is open, so the page can leave its chat shortcuts alone. */
  onSurface(open: boolean): void;
  /** `open` is the shell's own way to open another program (a panel that links to a sibling, such as the profile card's Edit card). */
  renderProgram(program: Program, open: (id: string) => void): ReactNode;
  /** One scope of the settings layer, or null while the scene is not loaded; kept out of the shell so it can be stood in for. */
  renderSettings(scope: SettingsScopeId, onClose: () => void, open: (programId: string) => void): ReactNode;
  /** The Casting Call for Swap persona (the Cast wing's own picker and cast), or null while the scene is not loaded. */
  renderPersonaSwap(onClose: () => void, onNew: () => void): ReactNode;
  /** The open scene's chat as the server now has it (a rename), handed back to the page. */
  onChat(chat: Chat): void;
  /** Opens the page's find panel (the narrow header menu's Search). */
  onFind?(): void;
  children: ReactNode;
}

export function MessengerChrome({ ctx, chatId, scene, name, personaName, programs, request, actions, loreBooks, onBack, onTake, onSurface, renderProgram, renderSettings, renderPersonaSwap, onChat, onFind, children }: MessengerChromeProps): JSX.Element {
  const shell = useRef<HTMLDivElement>(null);
  const left = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const nav = useMessengerNav(programs, request);
  const { selected, navOpen, setNavOpen } = nav;
  const [settings, setSettings] = useState<SettingsScopeId | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [pins, setPins] = useState(() => readPins(ctx.prefs));
  const [hidden, setHidden] = useState(() => readHidden(ctx.prefs));
  const width = useSceneWidth(shell);
  const narrow = isNarrow(width);
  const [members, setMembers] = useState(true);
  // The member list closes whenever the scene becomes compact (on open or on a resize), as Discord does; it can be opened again by hand.
  const compact = isCompact(width);
  useEffect(() => { if (compact) setMembers(false); }, [compact]);
  const kind = selected ? surfaceOf(selected.id) : null;
  const docked = kind !== null && isDockedKind(kind);
  const modal = settings !== null || (kind !== null && isModalKind(kind));
  const surface = selected !== undefined || settings !== null;
  useEffect(() => { onSurface(surface); return () => onSurface(false); }, [onSurface, surface]);
  const focus = useMessengerFocus({ left, menu, navOpen, narrow, setNavOpen });
  useEscapeKey(nav.close, docked && !modal, { outsideFields: true });
  // Whatever had focus when a surface opened gets it back when the last one closes (a layer returns it itself).
  useEffect(() => {
    if (surface || !opener.current) return;
    if (opener.current.isConnected) opener.current.focus();
    opener.current = null;
  }, [surface]);
  const holderOf = useProgramHolders();
  // A program that floats keeps its holder, so it is rendered even when it was never opened docked this session (a pop-out restored from the saved prefs).
  const [floated, setFloated] = useState<string[]>([]);
  const floatedOn = useCallback((id: string): void => setFloated((f) => (f.includes(id) ? f : [...f, id])), []);
  const floating = useMemo(() => wingBodyPopouts((id) => <FloatedBody id={id} holder={holderOf(id)} onShow={floatedOn} />).filter((k) => programs.some((p) => k.id === `panel.${p.id}`)), [programs, holderOf, floatedOn]);
  const rendered = useMemo(() => [...nav.visited, ...floated.filter((id) => !nav.visited.includes(id))], [nav.visited, floated]);
  const { recents, retry } = useRecentCharacters(ctx.api);
  const characterId = scene?.chat.cast.character.id ?? "";
  const all = useMemo(() => (recents.state === "ready" ? recents.scenes : []), [recents]);
  const rows = useMemo(() => recentCharacters(all, hidden, characterId), [all, hidden, characterId]);
  const notify = useNotifyPrefs(ctx, characterId);
  const everyScene = useMemo(() => scenesOfCharacter(all, characterId), [all, characterId]);
  const mine = useMemo(() => notify.visible(everyScene, chatId), [notify, everyScene, chatId]);
  const manage = useSceneManage({ ctx, openId: chatId, muted: notify.muted, onToggleMute: notify.toggleMute, onRenamedOpen: onChat, onLeave: onBack, refresh: retry });
  const marks = useReadMarks(ctx.prefs, chatId, scene?.messageCount ?? null);
  const unreadScenes = useMemo(() => unreadByScene(marks, all, chatId), [marks, all, chatId]);
  const unreadCharacters = useMemo(() => unreadByCharacter(unreadScenes, all), [unreadScenes, all]);
  const regexCount = scene?.chat.regex?.sets?.length ?? 0;
  const features = useMemo<SidebarFeature[]>(() => [
    ...programs.filter((p) => p.panel).map((p) => ({ id: p.id, title: p.title, icon: p.icon })),
    ...(regexCount > 0 ? programs.filter((p) => p.id === "regex").map((p) => ({ id: p.id, title: `Regex (${regexCount})`, icon: p.icon })) : []),
  ], [programs, regexCount]);
  const has = (id: string): boolean => programs.some((p) => p.id === id);
  // Behind a modal or the drawer the floating pop-out panels cannot be reached (RoleCall makes the scene's other floating controls inert, DiscordChrome.tsx:193-203).
  useLayoutEffect(() => {
    if (!modal && !navOpen) return undefined;
    const layers = [...(shell.current?.closest(".scs")?.querySelectorAll<HTMLElement>(".po-layer") ?? [])];
    const was = layers.map((l) => l.hasAttribute("inert"));
    layers.forEach((l) => l.setAttribute("inert", ""));
    return () => layers.forEach((l, i) => { if (!was[i]) l.removeAttribute("inert"); });
  }, [modal, navOpen]);
  const remember = (): void => { if (!surface && document.activeElement instanceof HTMLElement) opener.current = document.activeElement; };
  const open = (id: string): void => { remember(); setSettings(null); nav.open(id); };
  const openSettings = (scope: SettingsScopeId): void => { remember(); nav.close(); setNavOpen(false); setSettings(scope); };
  const pick = (id: string): void => { nav.close(); setSettings(null); if (id !== chatId) handOffScene(id); };
  const newScene = (): void => {
    if (characterId === "") return;
    ctx.api.startScene(characterId).then((chat) => { forgetRecents(); handOffScene(chat.id); if (chat.startNotes?.length) ctx.setStatus(chat.startNotes.join(" ")); }, (e: unknown) => ctx.setStatus(`could not start a new scene: ${toErrorMessage(e)}`));
  };
  const leave = (): void => { setHidden(hideCharacter(ctx.prefs, characterId)); nav.close(); onBack(); };
  const toggleMembers = (): void => { if (docked) { nav.close(); setMembers(true); } else setMembers(!members); };
  const avatar = scene ? <SceneAvatar ctx={ctx} scene={{ ...scene.chat, characterName: name, hasPortrait: scene.hasPortrait }} /> : <Avatar name={name} />;
  const panels = useMemo<PanelSpec[]>(() => programs.map((p) => ({ id: p.id, label: p.title, icon: p.icon, pinned: pins.includes(p.id), kind: KIND_LABEL[surfaceOf(p.id)], group: WING_LABEL[p.wing] })), [programs, pins]);
  const lore = useLoreCount(ctx.api, scene?.chat.id ?? null, loreBooks, scene?.chat.lore);
  const topic = topicLine({ characterName: name, messages: scene?.messageCount ?? 0, lorebooksOn: lore, directorOn: has(`prop-${DIRECTOR_PROP_ID}`) });
  const showMembers = members && !docked && scene !== null;
  return (
    <div ref={shell} className="msn" data-nav-open={navOpen} data-members={showMembers} data-surface={kind ?? undefined}>
      <div className="msn-bg" inert={modal}>
        {navOpen && <Scrim label="Close recent characters" onClick={focus.closeNav} />}
        <div ref={left} className="msn-left">
          <Rail ctx={ctx} current={{ characterId, name, avatar }} rows={rows} unread={unreadCharacters} canStart={scene !== null} onHome={onBack}
            onChat={() => nav.close()} onPick={(s) => pick(s.id)} onNew={newScene} onBrowse={() => setBrowsing(true)} />
          <Sidebar character={{ id: characterId, name }} recents={recents} scenes={mine} unread={unreadScenes} noRecents={rows.length === 0}
            open={scene ? { id: chatId, title: scene.chat.title, takes: scene.takes, activeTakeId: scene.chat.activeBranchId } : null}
            features={features} canAddFeature={has("props")} persona={{ name: personaName, canOpen: has("persona") }} ai={{ connected: scene?.chat.connection !== undefined, canOpen: has("model") }}
            canSwitchPersona={scene !== null} swap={swapping ? renderPersonaSwap(() => setSwapping(false), () => open("persona")) : null} notify={notify.view} muted={notify.muted} sceneMenu={manage.menu} onNotify={notify.change} canSettings={scene !== null} onClose={focus.closeNav} onRetry={retry} onPickScene={(s) => pick(s.id)} onNewScene={newScene} onTake={onTake}
            onFeature={open} onAddFeature={() => open("props")} onCharacterSettings={() => openSettings("character")} onLeave={leave} onSceneSettings={() => openSettings("scene")}
            onPersona={() => open("persona")} onAi={() => open("model")} onSwitchPersona={() => setSwapping(!swapping)} onUserSettings={() => openSettings("user")} />
        </div>
        <div className="msn-main">
          <Header title={scene?.chat.title.trim() || name} topic={topic} actions={actions} panels={panels} openId={selected?.id ?? null} members={showMembers} compact={compact} navOpen={navOpen} menuRef={menu} inert={navOpen}
            onMenu={() => setNavOpen(!navOpen)} onOpen={open} onClose={nav.close} onTogglePin={(id) => setPins(togglePin(ctx.prefs, id))} onMembers={toggleMembers} onFind={onFind} />
          <div className="msn-body">
            <div className="msn-chat" role="region" aria-label="Conversation" data-msn-chat="" inert={navOpen || (compact && showMembers)}>{children}</div>
            {selected && docked && <DockedSurface ctx={ctx} program={selected} holder={holderOf(selected.id)} pinned={pins.includes(selected.id)} onTogglePin={() => setPins(togglePin(ctx.prefs, selected.id))} onClose={nav.close} />}
            {showMembers && scene && <Members ctx={ctx} scene={scene} name={name} drawer={compact} canOpen={has("participants")} onOpen={() => open("participants")} onClose={() => setMembers(false)} />}
          </div>
        </div>
      </div>
      {manage.dialog}
      {browsing && <CharacterLibrary ctx={ctx} currentId={characterId} onClose={() => setBrowsing(false)} onStarted={forgetRecents} />}
      {selected && !docked && <FloatingSurface ctx={ctx} program={selected} holder={holderOf(selected.id)} onClose={nav.close} workshop={{ name, avatar, programs, onOpen: open }} />}
      {scene && floating.length > 0 && <PopoutHost ctx={ctx} chat={scene.chat} kinds={floating} onChat={onChat} />}
      {settings && renderSettings(settings, () => setSettings(null), open)}
      <ProgramPortals ids={rendered} programs={programs} holderOf={holderOf} render={(p) => renderProgram(p, open)} />
    </div>
  );
}

/** A floating program's body: its holder node, and a note to the shell that the program must be rendered while it floats. */
function FloatedBody({ id, holder, onShow }: { id: string; holder: HTMLElement; onShow(id: string): void }): JSX.Element {
  useLayoutEffect(() => onShow(id), [id, onShow]);
  return <ProgramSlot holder={holder} />;
}
