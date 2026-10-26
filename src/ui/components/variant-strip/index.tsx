/**
 * VariantStrip - the portrait card's variant selector (RC-style): a Base tile plus one tile per
 * character variant, a + to add one, and (when a variant is active) a small row to rename it, pick its
 * merge mode (mirror vs full override), and remove it. Selecting a tile drives the editor's active
 * variant; the merge itself is applyVariant. Tokens only.
 */
import { Button, Tile } from "../button";
import type { JSX } from "react";
import type { CharacterVariant } from "../../../entities/character/schema";
import styles from "./styles.module.css";
import { useArtSrc } from "../../_shared/art-cache";

export interface VariantStripProps {
  variants: CharacterVariant[];
  activeId: string | null;
  /** the base portrait, for the Base tile background */
  artUrl: string | null;
  /** per-variant own art (only when that variant overrides media.portrait) */
  variantArt?: Readonly<Record<string, string | null>>;
  onSelect(id: string | null): void;
  onAdd(): void;
  onRemove(id: string): void;
  onRename(id: string, label: string): void;
  onMode(id: string, mirrorBase: boolean): void;
}

function VariantTile({ active, label, own, onSelect, title }: { active: boolean; label: string; own: string | null; onSelect(): void; title: string }): JSX.Element {
  const external = !!own?.startsWith("http");
  const art = useArtSrc(external ? null : own);
  const src = external ? own : art.src;
  return <Tile ref={art.ref} kind="thumb" label={label} title={title} selected={active} onClick={onSelect}
    art={<span className={styles.face} style={src ? { backgroundImage: `url("${src}")` } : undefined}><i>{label}</i></span>} />;
}

export function VariantStrip({
  variants,
  activeId,
  artUrl,
  variantArt = {},
  onSelect,
  onAdd,
  onRemove,
  onRename,
  onMode,
}: VariantStripProps): JSX.Element {
  const active = activeId ? variants.find((v) => v.id === activeId) ?? null : null;
  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <VariantTile active={activeId === null} label="Base" own={artUrl} onSelect={() => onSelect(null)} title="The base character" />
        {variants.map((v) => {
          const own = variantArt[v.id] ?? null;
          return <VariantTile key={v.id} active={activeId === v.id} label={v.label || "Variant"} own={own} onSelect={() => onSelect(v.id)} title={own ? `${v.label || "Variant"} · own art` : `${v.label || "Variant"} · inherits base art (change art while this variant is selected)`} />;
        })}
        <Tile kind="add" label="Add a variant" onClick={onAdd} />
      </div>
      {active && (
        <div className={styles.editRow}>
          <input
            className={styles.name}
            value={active.label ?? ""}
            placeholder="Variant name"
            onChange={(e) => onRename(active.id, e.target.value)}
          />
          <label className={styles.mode} title="Full override replaces each section you edit; mirror overlays onto the base">
            <input type="checkbox" checked={active.mirrorBase === false} onChange={(e) => onMode(active.id, !e.target.checked)} />
            full
          </label>
          <Button size="sm" variant="danger" onClick={() => onRemove(active.id)} title="Remove this variant">
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
