/**
 * The Dashboard's featured and structural cells (RoleCall `BentoDashboard.tsx:1595-1695,1840-1860,1900-1961,1967-2038,2103-2169,
 * 2341-2423`): Featured Cast with its arc dots, TV Tree Structure (a mini tree and OPEN FULL TREE), Spotlight Location and Featured
 * Creature. The Cross-Reference Graph cell is cell-graph.tsx.
 */
import { useState, type CSSProperties, type JSX } from "react";
import { Button, Card, ListRow, Tile } from "../../../../components/button";
import { arcOf, type CompendiumEntry } from "../../../../../core/compendium";
import type { BookModel } from "../compendium-core";
import { BLANK, GLYPH, initialsOf, typeRole } from "../compendium-core";
import { Cell, Empty } from "./cell";
import type { TreeNode } from "../../../../../core/compendium";

type Open = { onOpen(id: string): void };
const str = (e: CompendiumEntry, key: string): string => (typeof e.data[key] === "string" ? (e.data[key] as string) : "");
const count = (e: CompendiumEntry, key: string): number => (Array.isArray(e.data[key]) ? (e.data[key] as unknown[]).length : 0);
const tc = (type: string): CSSProperties => ({ "--tc": typeRole(type) } as CSSProperties);
const tv = (type: string): Record<`--${string}`, string> => ({ "--tc": typeRole(type) });

export function FeaturedCast({ m, onOpen }: { m: BookModel } & Open): JSX.Element {
  const c = m.dashboard.featured.character;
  if (!c) return <Cell title="Featured Cast"><Empty>No character yet.</Empty></Cell>;
  const arc = arcOf(c);
  return (
    <Cell title="Featured Cast">
      <div className="cp-cast" style={tc("character")}>
        <Tile kind="thumb" label={`Open ${c.name}`} art={initialsOf(c.name)} onClick={() => onOpen(c.id)} />
        <div className="bd">
          {str(c, "subtitle") && <div className="sub">{str(c, "subtitle")}</div>}
          <Button variant="link" onClick={() => onOpen(c.id)}>{c.name}</Button>
          {c.tagline && <div className="tg">{c.tagline}</div>}
          <div className="rule" />
          <div className="ar">ARC</div>
          {arc.moments.length === 0 ? <div className="tg">No arc yet</div> : (
            <>
              <div className="dots">{arc.moments.map(/* bounded-ok: fields of one entry card, one run's summary, or capped by a SHOWN/LIMIT constant */ (_, i) => <span key={i} className="seg"><i className={i === arc.current ? "cur" : ""} />{i < arc.moments.length - 1 && <u />}</span>)}</div>
              <div className="now">Currently: {arc.label || BLANK}</div>
            </>
          )}
        </div>
      </div>
      <div className="cp-tiles">
        <div><span className="l">RELATIONS</span><span className="v">{count(c, "relationships")}</span></div>
        <div><span className="l">MEMORIES</span><span className="v">{count(c, "memories")}</span></div>
        <div><span className="l">CROSS-REFS</span><span className="v">{m.graph.nodes.find((n) => n.id === c.id)?.refs ?? 0}</span></div>
      </div>
    </Cell>
  );
}

const LIMIT_ENTRIES = 60;

function TreeRow({ node, depth, m, onOpen }: { node: TreeNode; depth: number; m: BookModel } & Open): JSX.Element {
  const [open, setOpen] = useState(depth < 2);
  const has = node.children.length > 0 || node.entryIds.length > 0;
  return (
    <>
      <div className={`tn${has ? " go" : ""}`} style={{ paddingLeft: depth * 12 }} onClick={has ? () => setOpen(!open) : undefined}>{has ? (open ? "▾" : GLYPH.sep) : GLYPH.dot} {node.label}</div>
      {open && node.children.map((c) => <TreeRow key={c.id} node={c} depth={depth + 1} m={m} onOpen={onOpen} />)}
      {open && node.entryIds.slice(0, LIMIT_ENTRIES).map(/* bounded-ok: fields of one entry card, one run's summary, or capped by a SHOWN/LIMIT constant */ (id) => <ListRow key={id} variant="tree" depth={depth + 1} leading={GLYPH.diamond} label={m.byId.get(id)?.name ?? id} onClick={() => onOpen(id)} />)}
      {open && node.entryIds.length > LIMIT_ENTRIES && <div className="tn" style={{ paddingLeft: depth * 12 + 12 }}>+{node.entryIds.length - LIMIT_ENTRIES} more</div>}
    </>
  );
}

export function TreeCell({ m, onOpen, onTree }: { m: BookModel; onTree(): void } & Open): JSX.Element {
  return (
    <Cell title="TV Tree Structure">
      <div className="cp-tree">{m.entries.length === 0 ? <Empty>No tree built yet.</Empty> : <TreeRow node={m.tree.root} depth={0} m={m} onOpen={onOpen} />}</div>
      <Button block size="sm" onClick={onTree}>OPEN FULL TREE {GLYPH.right}</Button>
    </Cell>
  );
}

export function Spotlight({ m, onOpen }: { m: BookModel } & Open): JSX.Element {
  const l = m.dashboard.featured.location;
  return (
    <Cell title="Spotlight Location" dot={typeRole("location")}>
      {!l ? <Empty>No location yet.</Empty> : (
        <Card kind="choice" vars={tv("location")} heading={l.name} subtitle={l.tagline || undefined} onClick={() => onOpen(l.id)}>
          <span className="cp-spot">
            {str(l, "description") && <span className="d">{str(l, "description")}</span>}
            <span className="p">{str(l, "parent_location") ? `PARENT: ${str(l, "parent_location")}` : "NO PARENT"}</span>
          </span>
        </Card>
      )}
    </Cell>
  );
}

export function Creature({ m, onOpen }: { m: BookModel } & Open): JSX.Element {
  const c = m.dashboard.featured.creature;
  return (
    <Cell title="Featured Creature" dot={typeRole("creature")}>
      {!c ? <Empty>No creature yet.</Empty> : (
        <Card kind="choice" vars={tv("creature")} kicker={initialsOf(c.name)} heading={c.name} subtitle={c.tagline || undefined} onClick={() => onOpen(c.id)}>
          <span className="cp-creature">
            <span className="tags">{["classification", "rarity", "disposition"].map((k) => str(c, k) && <b key={k}>{str(c, k)}</b>)}</span>
            {str(c, "description") && <span className="d">{str(c, "description")}</span>}
            <span className="ft"><span>{Array.isArray(c.data["abilities"]) ? `${count(c, "abilities")} abilities` : BLANK}</span>{str(c, "habitat") && <small>{str(c, "habitat")}</small>}</span>
          </span>
        </Card>
      )}
    </Cell>
  );
}
