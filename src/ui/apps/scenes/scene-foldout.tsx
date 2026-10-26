/**
 * FoldoutTabs: the strip over a wing panel (RoleCall's FoldoutTabs): the "Scene / Cast" breadcrumb and
 * one square tile per panel the wing owns, the open one marked, each with a small subtitle. The strip sticks to the
 * top of the panel. A wing with one panel shows the breadcrumb alone, the panel's name (and its subtitle) at the far end.
 */
import { Tabs } from "../../components/button";
import type { JSX } from "react";

export interface FoldoutTab<Id extends string = string> { id: Id; label: string; meta?: string }

/** The tab strip over a wing panel: the breadcrumb and one square tile per panel, the open one marked. */
export function FoldoutTabs<Id extends string>({ area, group, tabs, active, onSelect }: {
  area: string; group: string; tabs: readonly FoldoutTab<Id>[]; active: Id; onSelect(id: Id): void;
}): JSX.Element {
  const only = tabs.length <= 1 ? tabs[0] : undefined;
  return (
    <nav className="fold" aria-label={`${area} navigation, ${group}`} data-part="scene.wings.tabs">
      <div className="crumb">{area} <i>/</i> <b>{group}</b>{only && <span className="cl">{only.label}{only.meta ? ` · ${only.meta}` : ""}</span>}</div>
      {!only && (
        <Tabs label={`${group} sections`} items={tabs.map((t) => ({ value: t.id, label: <><b>{t.label}</b>{t.meta && <small>{t.meta}</small>}</> }))} value={active} onChange={onSelect} />
      )}
    </nav>
  );
}
