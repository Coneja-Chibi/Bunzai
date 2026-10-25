/** Shared authored words and carried metadata across compact and close-up Library views. */
import { useCallback, type JSX } from "react";
import type { StudioEntitySummary } from "../../app-contract";
import { plural } from "../../../core/text";
import { useCardPeek, type PeekQueue } from "./peek-queue";
import type { DeckViewContext, PiecePeek } from "./view-contract";
import type { CardFacts } from "./carousel-core";
import styles from "./piece-preview.module.css";

export function PiecePreview({ peek, cardFacts, expanded = false }: { peek?: PiecePeek | null; cardFacts?: CardFacts; expanded?: boolean }): JSX.Element | null {
  if (!peek && !cardFacts) return null;
  const facts = [
    peek?.filled ? `${peek.filled} fields` : null,
    peek?.tokens ? `~${plural(peek.tokens, "token")}` : null,
    peek?.blocks !== undefined ? plural(peek.blocks, "block") : null,
    ...Object.entries(peek?.samplers ?? {}).map(([key, value]) => `${key === "temperature" ? "Temperature" : key === "topP" ? "Top P" : "Top K"} ${value}`),
    peek?.samplerSet ? `${peek.samplerSet} sampler set` : null,
    peek?.formatParts?.join(" + "),
    ...cardFacts?.stats.map(({ label, value }) => `${label}: ${value}`) ?? [],
    cardFacts?.off ? "Off" : null,
  ].filter(Boolean).join(" · ");
  return (
    <span className={`${styles.preview}${expanded ? ` ${styles.expanded}` : ""}`}>
      {peek?.tagline && <span className={styles.tagline} title={peek.tagline}>{peek.tagline}</span>}
      {peek?.description && <span className={styles.description} title={expanded ? undefined : peek.description}>{peek.description}</span>}
      {cardFacts?.words && cardFacts.words !== peek?.description && <span className={styles.description} title={cardFacts.words}>{cardFacts.words}</span>}
      {facts && <span className={styles.facts}>{facts}</span>}
      {!!peek?.tags?.length && <span className={styles.tags}>{peek.tags.join(", ")}</span>}
    </span>
  );
}

/** Compact views share the shelf's bounded, write- and lifetime-fenced peek queue. */
export function QueuedPiecePreview({ e, queue, ctx, expanded = false }: { e: StudioEntitySummary; queue: PeekQueue; ctx: DeckViewContext; expanded?: boolean }): JSX.Element {
  const [ref, peek] = useCardPeek(queue, e);
  // The preview can be empty or below the art; admission follows its visible card instead.
  const observe = useCallback((el: HTMLSpanElement | null) => ref(el?.closest<HTMLElement>("[data-pick]") ?? el), [ref]);
  return <span ref={observe}><PiecePreview peek={peek} cardFacts={ctx.cardFacts?.(e)} expanded={expanded} /></span>;
}
