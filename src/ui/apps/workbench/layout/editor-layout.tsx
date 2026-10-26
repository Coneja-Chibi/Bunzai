/**
 * EditorLayout - the one place an editor's sections get arranged. An editor declares its sections (id, title,
 * fields) plus an optional rail (portrait and friends) and this renders them for the picked `editor.frame`:
 * core = the three-column bento of cards; two-pane = a section list left, one section right; tabbed-menu = a
 * numbered menu, one section at a time; card-stack = every section a card in one scrolling column; long-form
 * = one continuous document with a contents margin. Every section stays mounted in every frame (a section
 * that is not open is only `hidden`), so no field, action or piece of local state is lost by switching frames.
 * Frames change arrangement and look only; the editor's data and handlers live in the editor.
 */
import { ListRow } from "../../../components/button";
import { useId, useState, type JSX, type KeyboardEvent, type ReactNode } from "react";
import { useSurfaceVariant } from "../../../_shared/surface-variant";
import { BentoCard } from "../../../components/bento-card";
import es from "../editor-styles";
import { bentoColumns, navTarget, resolveActive, type EditorSection } from "./editor-layout-core";
import s from "./editor-layout.module.css";

export interface EditorLayoutProps {
  /** names the section menu for assistive tech ("Persona sections") */
  label: string;
  sections: readonly EditorSection[];
  /** the portrait / identity column; sticky left in the bento, the first block in every other frame */
  rail?: ReactNode;
  /** the open section when the caller owns it (menu frames); omit to let the layout remember it */
  active?: string | null;
  /** told every time the person picks a section; with `active` it is the only way the open section changes */
  onActiveChange?: (id: string) => void;
  /** a rail that holds wide panels (a prompt editor, a preview) gets a wider column in the side-rail frames */
  railWidth?: "narrow" | "wide";
}

export function EditorLayout({ label, sections, rail, active: activeProp, onActiveChange, railWidth = "narrow" }: EditorLayoutProps): JSX.Element {
  const frame = useSurfaceVariant("editor.frame");
  const uid = useId();
  const [inner, setInner] = useState<string | null>(null);
  const open = activeProp !== undefined ? activeProp : inner;
  const setOpen = (id: string): void => {
    if (activeProp === undefined) setInner(id);
    onActiveChange?.(id);
  };
  const active = resolveActive(sections, open);
  const domId = (id: string): string => `${uid}-${id}`;

  if (frame === "core") {
    const card = (sec: EditorSection): JSX.Element => (
      <BentoCard key={sec.id} title={sec.title} filled={sec.filled} aff={sec.aff} off={sec.dim}>{sec.node}</BentoCard>
    );
    const [middle, right] = bentoColumns(sections);
    return (
      <div className={es.bento} data-ef="layout" data-part="editor.frame" data-frame="core">
        {rail != null && <div className={`${es.bcol} ${es.bcolLeft}`}>{rail}</div>}
        <div className={es.bcol}>{middle.map(card)}</div>
        <div className={es.bcol}>{right.map(card)}</div>
      </div>
    );
  }

  const tabbed = frame === "two-pane" || frame === "tabbed-menu";
  const numeral = (sec: EditorSection, at: number): string => sec.no ?? String(at + 1);
  const heading = (sec: EditorSection, at: number): JSX.Element => (
    <header data-ef="head" data-part="editor.section.header">
      <span data-ef="no" aria-hidden="true">{numeral(sec, at)}</span>
      <h3 id={`${domId(sec.id)}-h`} data-ef="title">{sec.title}</h3>
      {sec.filled !== undefined && <span className={`${s.dot}${sec.filled ? ` ${s.full}` : ""}`} role="img" aria-label={sec.filled ? "has content" : "empty"} />}
      {sec.hint && <span data-ef="hint">{sec.hint}</span>}
    </header>
  );
  const section = (sec: EditorSection, at: number): JSX.Element => {
    const on = sec.id === active;
    const body = <>{heading(sec, at)}<div data-ef="body">{sec.node}</div></>;
    return tabbed ? (
      <section key={sec.id} id={domId(sec.id)} role="tabpanel" aria-labelledby={`${domId(sec.id)}-t`} hidden={!on}
        data-ef="section" data-part="editor.section" data-open={on} className={sec.dim ? s.dim : undefined}>{body}</section>
    ) : (
      <section key={sec.id} id={domId(sec.id)} tabIndex={-1} aria-labelledby={`${domId(sec.id)}-h`}
        data-ef="section" data-part="editor.section" className={sec.dim ? s.dim : undefined}>{body}</section>
    );
  };

  const move = (e: KeyboardEvent<HTMLElement>): void => {
    const target = navTarget(sections.map((x) => x.id), active ?? "", e.key);
    if (target === null) return;
    e.preventDefault();
    setOpen(target);
    [...e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')].find((el) => el.dataset.sec === target)?.focus();
  };
  const jump = (id: string): void => {
    const el = document.getElementById(domId(id));
    el?.focus({ preventScroll: true });
    el?.scrollIntoView?.({ block: "start" });
  };
  const numeralOf = (sec: EditorSection, at: number): JSX.Element => <span data-ef="no" aria-hidden="true">{numeral(sec, at)}</span>;
  const titleOf = (sec: EditorSection): JSX.Element => <span data-ef="tab-title">{sec.title}</span>;

  const nav = tabbed ? (
    <div role="tablist" aria-label={label} aria-orientation={frame === "two-pane" ? "vertical" : "horizontal"} data-ef="nav" data-part="editor.nav" onKeyDown={move}>
      {sections.map((sec, at) => (
        <ListRow
          key={sec.id}
          role="tab"
          id={`${domId(sec.id)}-t`}
          data-sec={sec.id}
          aria-selected={sec.id === active}
          aria-controls={domId(sec.id)}
          tabIndex={sec.id === active ? 0 : -1}
          data-ef="tab"
          onClick={() => setOpen(sec.id)}
          leading={numeralOf(sec, at)}
          label={titleOf(sec)}
        />
      ))}
    </div>
  ) : frame === "long-form" ? (
    <nav aria-label={`${label} contents`} data-ef="nav" data-part="editor.nav">
      {sections.map((sec, at) => <ListRow key={sec.id} data-ef="tab" onClick={() => jump(sec.id)} leading={numeralOf(sec, at)} label={titleOf(sec)} />)}
    </nav>
  ) : null;

  return (
    <div data-ef="layout" data-part="editor.frame" data-frame={frame} data-rail={rail == null ? "none" : railWidth}>
      {rail != null && <div className={s.rail} data-ef="rail">{rail}</div>}
      {nav}
      <div data-ef="panels" data-part="editor.panels">{sections.map(section)}</div>
    </div>
  );
}
