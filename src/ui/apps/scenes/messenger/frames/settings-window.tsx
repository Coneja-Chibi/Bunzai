/**
 * The Messenger scoped settings layer (approved wireframe messenger-discord/settings.html): a left nav under a scope header (you, a character, a scene) whose categories expand in
 * place to their sections; one long scrolling page per category, every section a block (heading, description, rows) with the nav following the scroll; and a stack of deeper pages
 * (a row with a chevron opens one, the back arrow pops it). Below 900px the nav and the page are two screens and the sections become a chip row. It renders DATA: the categories, sections
 * and deeper pages come from the caller (settings content, phase 4), their rows from settings-rows.tsx; this file owns navigation and nothing about what a setting is. Bodies open a deeper
 * page through useSettingsNav().
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type JSX, type ReactNode } from "react";
import { Ic, type IconName } from "../../../../_shared/ic";
import { Button, Chip, IconButton, ListRow } from "../../../../components/button";
import { isEscapeClose } from "../../../../_shared/use-escape-key";
import { Layer } from "./layer";
import { useBackspaceUp } from "./use-backspace-up";
import { searchSettings } from "./settings-search";

export interface SettingsSection {
  id: string;
  title: string;
  description?: string;
  /** extra words the settings search finds this section by (its rows, or what a tool-shaped body holds) */
  keywords?: readonly string[];
  body: ReactNode;
}
export interface SettingsCategory {
  id: string;
  label: string;
  icon: IconName;
  /** a small header in the nav above this category (shown when it changes from the previous one) */
  group?: string;
  /** drawn above the first section (the scene's art and name) */
  hero?: ReactNode;
  sections: SettingsSection[];
}
export interface SettingsScope {
  id: string;
  title: string;
  subtitle?: string;
  /** the small caps line above the title ("Character", "Scene") */
  kind?: string;
  /** art or initials before the title */
  leading?: ReactNode;
  /** the edit link under the title ("Edit profile"); drawn only when given */
  edit?: { label: string; onClick(): void };
  categories: SettingsCategory[];
}
export interface SettingsDeepPage { title: string; sections: SettingsSection[] }

export interface SettingsWindowProps {
  scope: SettingsScope;
  /** looks up a deeper page by id; null or undefined means there is none and the row does nothing */
  resolveDeep?(id: string): SettingsDeepPage | null | undefined;
  initialCategory?: string;
  onClose(): void;
  /** called with the deeper-page ids, outermost first, whenever the stack changes */
  onDeepChange?(stack: readonly string[]): void;
}

export interface SettingsNav { open(deepId: string): void; back(): void; depth: number }
const NavContext = createContext<SettingsNav>({ open: () => undefined, back: () => undefined, depth: 0 });
/** For a section body: open a deeper page, or step back out of one. */
export function useSettingsNav(): SettingsNav { return useContext(NavContext); }

interface DeepEntry { id: string; from: string }

function Block({ section }: { section: SettingsSection }): JSX.Element {
  return (
    <section className="msn-st-blk" data-section={section.id} data-part="scene.messenger.settings.section">
      <h2>{section.title}</h2>
      {section.description ? <p className="msn-st-secd">{section.description}</p> : null}
      <div className="msn-st-rows">{section.body}</div>
    </section>
  );
}

export function SettingsWindow({ scope, resolveDeep, initialCategory, onClose, onDeepChange }: SettingsWindowProps): JSX.Element {
  const { categories } = scope;
  const [catId, setCatId] = useState(() => (categories.some((c) => c.id === initialCategory) ? initialCategory : categories[0]?.id) ?? "");
  const [deep, setDeep] = useState<DeepEntry[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [screen, setScreen] = useState<"nav" | "page">("nav");
  const [query, setQuery] = useState("");
  const jump = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const backBtn = useRef<HTMLButtonElement>(null);
  const hold = useRef(0);
  const settled = useRef(false);

  const cat = categories.find((c) => c.id === catId) ?? categories[0];
  const top = deep.at(-1);
  const deepPage = top ? resolveDeep?.(top.id) ?? null : null;
  const hits = useMemo(() => searchSettings(scope, query), [scope, query]);
  const current = picked ?? cat?.sections[0]?.id ?? null;
  const sectionTitle = cat?.sections.find((s) => s.id === current)?.title ?? cat?.label ?? "";

  useEffect(() => { onDeepChange?.(deep.map((d) => d.id)); }, [deep, onDeepChange]);
  useEffect(() => {
    if (!settled.current) { settled.current = true; return; }
    if (deep.length) backBtn.current?.focus();
    else scroller.current?.focus();
  }, [deep.length]);
  useEffect(() => { scroller.current?.scrollTo?.({ top: 0 }); }, [catId, deep.length]);
  useBackspaceUp(deep.length > 0, useCallback(() => setDeep((stack) => stack.slice(0, -1)), []));

  const open = useCallback((id: string): void => {
    if (!resolveDeep?.(id)) return;
    setDeep((stack) => [...stack, { id, from: (stack.length ? resolveDeep(stack[stack.length - 1]?.id ?? "")?.title : undefined) ?? sectionTitle }]);
  }, [resolveDeep, sectionTitle]);
  const back = useCallback((): void => { setDeep((stack) => stack.slice(0, -1)); }, []);
  const nav = useMemo<SettingsNav>(() => ({ open, back, depth: deep.length }), [open, back, deep.length]);

  const pickCategory = (id: string): void => { setCatId(id); setPicked(null); setDeep([]); setScreen("page"); };
  const scrollToSection = (id: string): void => {
    const target = [...(scroller.current?.querySelectorAll<HTMLElement>("[data-section]") ?? [])].find((e) => e.dataset.section === id);
    if (!target) return;
    const calm = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.current?.scrollTo?.({ top: target.offsetTop - 8, behavior: calm ? "auto" : "smooth" });
  };
  const goSection = (id: string): void => {
    setPicked(id);
    hold.current = Date.now() + 700;
    scrollToSection(id);
  };
  // A search result opens its category first; the section is scrolled to once that page is drawn.
  useEffect(() => {
    const id = jump.current;
    jump.current = null;
    if (id) scrollToSection(id);
  });
  const pickHit = (categoryId: string, sectionId: string): void => {
    jump.current = sectionId;
    hold.current = Date.now() + 700;
    setQuery("");
    pickCategory(categoryId);
    setPicked(sectionId);
  };
  const follow = (): void => {
    const box = scroller.current;
    if (!box || deep.length || Date.now() < hold.current) return;
    const blocks = [...box.querySelectorAll<HTMLElement>("[data-section]")];
    let at = blocks[0];
    if (!at) return;
    for (const b of blocks) if (b.offsetTop - 80 <= box.scrollTop) at = b;
    if (box.scrollHeight > box.clientHeight && box.scrollTop + box.clientHeight >= box.scrollHeight - 4) at = blocks[blocks.length - 1] ?? at;
    setPicked(at.dataset.section ?? null);
  };

  let lastGroup: string | undefined;
  return (
    <Layer label={`${scope.title} settings`} onClose={onClose}>
      <NavContext.Provider value={nav}>
        <div className="msn-st" data-screen={screen} data-scope={scope.id}>
          <aside className="msn-st-nav" data-part="scene.messenger.settings.nav">
            <div className="msn-st-who" data-part="scene.messenger.settings.scope">
              {scope.leading}
              <div>
                {scope.kind ? <small>{scope.kind}</small> : null}
                <b>{scope.title}</b>
                {scope.subtitle ? <span>{scope.subtitle}</span> : null}
                {scope.edit && <Button variant="link" size="sm" icon="lucide:pencil" onClick={scope.edit.onClick} data-part="scene.messenger.settings.edit">{scope.edit.label}</Button>}
              </div>
            </div>
            <label className="msn-st-search">
              <Ic name="lucide:search" size={14} />
              <input type="search" data-part="scene.messenger.settings.search" value={query} placeholder="Search settings" aria-label="Search settings" onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (isEscapeClose(e.nativeEvent) && query !== "") { e.preventDefault(); setQuery(""); } }} />
            </label>
            {query.trim() !== "" ? (
              <nav className="msn-st-cats" aria-label="Search results">
                {/* bounded-ok: at most one row per section of the scope, well under a hundred */}
                {hits.map((h) => (
                  <ListRow key={`${h.categoryId}/${h.sectionId}`} label={h.sectionTitle} subtitle={h.categoryLabel} onClick={() => pickHit(h.categoryId, h.sectionId)} data-part="scene.messenger.settings.result" />
                ))}
                {hits.length === 0 && <p className="msn-st-secd" data-part="scene.messenger.settings.search-none">No setting matches "{query.trim()}".</p>}
              </nav>
            ) : (
            <nav className="msn-st-cats" aria-label="Settings categories">
              {categories.map(/* bounded-ok: fixed registry of panels / settings / props / platforms */ (c) => {
                const heading = c.group && c.group !== lastGroup ? c.group : null;
                lastGroup = c.group ?? lastGroup;
                const on = c.id === cat?.id;
                return (
                  <div key={c.id} className="msn-st-cat" data-category={c.id}>
                    {heading ? <div className="msn-st-cap">{heading}</div> : null}
                    <ListRow label={c.label} leading={<Ic name={c.icon} size={18} />} selected={on} aria-current={on ? "page" : undefined} onClick={() => pickCategory(c.id)} data-part="scene.messenger.settings.category" />
                    {on && (
                      <div className="msn-st-sub" role="group" aria-label={`${c.label} sections`}>
                        {c.sections.map(/* bounded-ok: fixed registry of panels / settings / props / platforms */ (s) => <ListRow key={s.id} label={s.title} selected={s.id === current} aria-current={s.id === current ? "true" : undefined} onClick={() => goSection(s.id)} data-part="scene.messenger.settings.nav-section" />)}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
            )}
          </aside>
          <section className="msn-st-page" aria-label={deepPage?.title ?? cat?.label}>
            <header className="msn-st-top" data-part="scene.messenger.settings.top">
              {deep.length > 0
                ? <IconButton ref={backBtn} label="Back" icon="lucide:arrow-left" onClick={back} data-part="scene.messenger.settings.back" />
                : <span className="msn-st-listback"><IconButton label="All categories" icon="lucide:chevron-left" onClick={() => setScreen("nav")} data-part="scene.messenger.settings.list-back" /></span>}
              <span className="msn-st-title">{top ? top.from : cat?.label}</span>
            </header>
            {deep.length === 0 && cat && (
              <div className="msn-st-chips" role="group" aria-label="Sections">
                {cat.sections.map(/* bounded-ok: fixed registry of panels / settings / props / platforms */ (s) => <Chip key={s.id} pressed={s.id === current} onClick={() => goSection(s.id)} data-part="scene.messenger.settings.chip">{s.title}</Chip>)}
              </div>
            )}
            <div ref={scroller} className="msn-st-scroll" tabIndex={-1} onScroll={follow} data-part="scene.messenger.settings.page">
              <div className="msn-st-in">
                {top ? (
                  deepPage ? <><h2 className="msn-st-h1">{deepPage.title}</h2>{deepPage.sections.map(/* bounded-ok: fixed registry of panels / settings / props / platforms */ (s) => <Block key={s.id} section={s} />)}</> : <p className="msn-st-secd">This page is not available.</p>
                ) : cat ? (
                  <>{cat.hero}{cat.sections.map(/* bounded-ok: fixed registry of panels / settings / props / platforms */ (s) => <Block key={s.id} section={s} />)}<div className="msn-st-spacer" /></>
                ) : <p className="msn-st-secd">Nothing to show here yet.</p>}
              </div>
            </div>
          </section>
        </div>
      </NavContext.Provider>
    </Layer>
  );
}
