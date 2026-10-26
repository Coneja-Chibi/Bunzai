/**
 * GalleryPane - the starter-recipe gallery (design/vs-regex-shelf-gallery.html wire 2, 1:1).
 * Opens from the TOC's "+ New rule" per the locked wire; hosted in the rail column like the bench
 * and the full check (companion pane, never a modal). Recipes grouped by category, plain English
 * first, before/after always visible - every pair is ENGINE-COMPUTED (template-catalog.test.ts),
 * so the card never promises what the engine did not do. "Use this" hands the caller a template;
 * "Start blank" keeps the old blank-rule path one tap away.
 */
import { Button, Card, IconButton } from "../../../components/button";
import type { JSX } from "react";
import { templatesByCategory, type RegexTemplateEntry } from "../../../../core/regex";
import gp from "./gallery-pane.module.css";

export interface GalleryPaneProps {
  onPick: (entry: RegexTemplateEntry) => void;
  onStartBlank: () => void;
  onClose: () => void;
}

export function GalleryPane({ onPick, onStartBlank, onClose }: GalleryPaneProps): JSX.Element {
  return (
    <section className={gp.pane} aria-label="Starter recipes">
      <div className={gp.phead}>
        <b className={gp.pheadB}>New rule</b>
        <span className={gp.pheadKick}>start from a recipe, or from nothing</span>
        <Button size="sm" onClick={onStartBlank}>Start blank</Button>
        <IconButton label="Close the recipes" variant="quiet" size="sm" icon="lucide:x" onClick={onClose} />
      </div>

      <div className={gp.grid}>
        {templatesByCategory().map((group) => (
          <div key={group.category} className={gp.groupWrap}>
            <span className={gp.cat}>{group.label}</span>
            <div className={gp.cards}>
              {group.entries.map((t) => (
                <Card key={t.id} kind="choice" onClick={() => onPick(t)} heading={t.name} subtitle={t.does}>
                  <span className={gp.ba}>
                    <span className={gp.baCell}>
                      <b className={gp.baKick}>Before</b>
                      {t.before}
                    </span>
                    <span className={`${gp.baCell} ${gp.baAfter}`}>
                      <b className={gp.baKick}>After</b>
                      {t.after}
                    </span>
                  </span>
                  <span className={gp.tplFoot}>Use this &middot; opens ready to edit</span>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
