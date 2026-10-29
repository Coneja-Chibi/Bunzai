/**
 * The Library's cards, ported from RoleCall's own library rows: ContentCharacterCard (the tall
 * portrait card) for characters and personas, ContentPresetCard for presets, ContentRegexCard for
 * regex sets, and the vertical AssetCard for lorebooks and every other deck.
 *
 * RC CARDS, HOPLIGHT TOOLS. Each card behaves exactly as a Tiles card does, because they are the
 * same piece on a different shelf:
 * - a tap STAGES it (shift ranges, ctrl adds), never opens it;
 * - a piece already on the Workbench is marked, not toggled;
 * - right-click is the shell's entity menu, and the "..." button opens that same menu;
 * - highlighting a name to copy it is not a tap.
 * And each carries the tools its deck's old shelf had, on the card itself: a lorebook or regex set
 * switches on and off, splits, copies, and merges when dropped onto another of its kind; a regex
 * set flags slow rules; a persona says whether it is the default.
 *
 * THE NAME IS THE BUTTON. The whole card takes a mouse tap, but the one real control for keyboards
 * and screen readers is the name, a native button reporting staged or not. The card itself carries
 * no button role, so its tool buttons are never controls nested inside another control.
 *
 * WHAT A CARD SAYS IT MUST KNOW. RC's cards carried likes, forks, authors, drafts and edit dates
 * from a cloud. Bunzai has none of that, so those slots say what the studio does know: when the
 * piece was imported, its source format, the facts the shelves already loaded, and the piece's own
 * words once a peek arrives. Nothing here is a placeholder dressed as data.
 *
 * ART IS A LAZY `<img>`, NOT A CSS BACKGROUND, fetched through
 * the shared art cache (M8, `_shared/art-cache.ts`) so the same piece shown elsewhere on the page
 * decrypts once. Each cover keeps its class's own `background-size`/`background-position` (set in
 * `rc-styles.ts`) mirrored on the `<img>` as `object-fit`/`object-position` inline, since that CSS
 * targets the div, not an `<img>` it does not know about; `pointer-events:none` and
 * `draggable={false}` keep the image out of the card's own drag-to-merge detection (a native image
 * drag carries `"Files"` in `dataTransfer.types`, which `droppable()` reads as an import drop).
 */
import { useCallback, useState, type CSSProperties, type DragEvent, type JSX, type MouseEvent, type ReactNode } from "react";
import type { StudioEntitySummary } from "../../app-contract";
import { BookCover } from "./book-cover";
import { ContextMenuButton } from "../../_shared/context-menu-button";
import { deckMeta, deckOf, pieceColor } from "../../_shared/decks";
import { useArtSrc } from "../../_shared/art-cache";
import { cardFacts, importedAgo, promptFormatWords, tokenLabel, type ShelfMeta } from "./carousel-core";
import { Icon } from "./icon";
import { useCardPeek, type PeekQueue } from "./peek-queue";
import { selectedText } from "./select-core";
import { pieceKey, versionedArtUrl, type DeckViewContext, type PiecePeek } from "./view-contract";
import { Ic } from "../../_shared/ic";
import { plural } from "../../../core/text";
import { Button, Toggle } from "../../components/button";

export interface CardProps {
  ctx: DeckViewContext;
  e: StudioEntitySummary;
  peeks: PeekQueue;
  meta: ShelfMeta;
  now: number;
  /** C-2: "item N of M" for a screen reader once most of the deck is
   * unmounted off-screen by virtualization. Optional - a caller that has not counted a position
   * (there is none outside the virtualized shelves) simply omits both. */
  posinset?: number;
  setsize?: number;
}

/** The one piece being dragged toward a merge. Module-level: there is only ever one drag at a time. */
let dragging: StudioEntitySummary | null = null;

/** The shared shell: staging, the open mark, menus, drag-to-merge, and the tone every card wears. */
function CardShell(props: CardProps & {
  className: string;
  nameClass: string;
  /** set on decks whose pieces merge by being dropped onto one another (lorebooks, regex sets) */
  onMerge?: (into: StudioEntitySummary, from: StudioEntitySummary) => void;
  children: (peek: PiecePeek | undefined, name: ReactNode) => ReactNode;
}): JSX.Element {
  const { ctx, e, peeks, onMerge } = props;
  const key = pieceKey(e);
  const isOpen = ctx.open.has(key);
  const staged = ctx.selected.has(key);
  const menuRef = ctx.menus.useContextMenu(() => ({ type: "entity", label: e.name, data: e }));
  const [peekRef, peek] = useCardPeek(peeks, e);
  const [over, setOver] = useState(false);
  const tone = pieceColor(e);

  const stage = (shift: boolean, meta: boolean): void => ctx.onPiece(e, { shift, meta });
  // One stable ref for both: an inline merge re-attached the menu and the observer on every render.
  const ref = useCallback((el: HTMLElement | null) => {
    menuRef(el);
    peekRef(el);
  }, [menuRef, peekRef]);

  /**
   * A merge drop is a card dragged onto a card. Files dragged in from the computer are an IMPORT and
   * pass straight through to the room, even if a merge drag ended without its dragend (a reload
   * that unmounted the source card) and left `dragging` set.
   */
  const droppable = (ev: DragEvent): boolean =>
    !ev.dataTransfer.types.includes("Files") &&
    Boolean(onMerge && dragging && dragging.kind === e.kind && dragging.id !== e.id);

  return (
    <div
      ref={ref}
      className={`rcard ${props.className}${isOpen ? " cast" : ""}${staged ? " pick" : ""}${over ? " over" : ""}`}
      style={{ "--t": tone } as CSSProperties}
      data-pick={key}
      aria-setsize={props.setsize}
      aria-posinset={props.posinset}
      title={isOpen ? `${e.name} is open on the Workbench` : staged ? `${e.name} is staged - tap to unstage` : `Stage ${e.name} for the Workbench`}
      draggable={Boolean(onMerge)}
      onDragStart={onMerge ? (ev: DragEvent) => {
        dragging = e;
        ev.dataTransfer.effectAllowed = "move";
        ev.dataTransfer.setData("text/plain", e.name);
      } : undefined}
      onDragEnd={onMerge ? () => { dragging = null; } : undefined}
      onDragOver={(ev: DragEvent) => {
        if (!droppable(ev)) return;
        ev.preventDefault();
        ev.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(ev: DragEvent) => {
        setOver(false);
        if (!droppable(ev) || !onMerge || !dragging) return;
        // Stop here: the room's own drop handler reads dropped FILES as an import.
        ev.preventDefault();
        ev.stopPropagation();
        const from = dragging;
        dragging = null;
        onMerge(e, from);
      }}
      onClick={(ev: MouseEvent) => {
        // A highlight is not a tap: copying a name must not stage the piece as a side effect.
        if (selectedText(window.getSelection())) return;
        stage(ev.shiftKey, ev.ctrlKey || ev.metaKey);
      }}
    >
      {props.children(
        peek,
        // Native Enter and Space fire a click that bubbles to the card's one handler above.
        <Button variant="link" block data-part="library.card.name" aria-pressed={staged} title={e.name}>
          {/* an inner span, because Chrome draws no ellipsis on a button itself */}
          <span className={`rnmx ${props.nameClass}`}>{e.name}</span>
        </Button>,
      )}
      {over && <span className="rdroptip">{`Drop to merge into ${e.name}`}</span>}
      {isOpen && <span className="rtick">on the workbench</span>}
      {staged && <span className="rcheck" />}
    </div>
  );
}


/**
 * A card footer's facts as one quiet line ("5/9 fields · ~29 tokens · Imported 9 hours ago") that
 * ends in an ellipsis when it runs out of room. Boxed chips in capitals were cut off mid-word at
 * RC's own card width and turned illegible below it.
 */
function Facts({ items }: { items: (string | null | undefined)[] }): JSX.Element | null {
  const shown = items.filter((x): x is string => Boolean(x));
  return shown.length ? <span className="rfacts" title={shown.join(" · ")}>{shown.join(" · ")}</span> : null;
}

function Foot({ e, now, left, facts }: { e: StudioEntitySummary; now: number; left?: string | null; facts?: (string | null | undefined)[] }): JSX.Element {
  return (
    <div className="rfoot">
      {facts ? <Facts items={facts} /> : <span className="rfleft">{left ?? importedAgo(e.importedAt, now) ?? ""}</span>}
      <span className="grow" />
      <ContextMenuButton name={e.name} className="rmore" />
    </div>
  );
}

/**
 * A set's shelf tools on the card: the on/off switch (an off set is skipped on export), Split,
 * Copy, and the menu. Every control stops its click, so using a tool never stages the card.
 */
function Tools(props: {
  e: StudioEntitySummary;
  on: boolean;
  offWords: string;
  onToggle(on: boolean): void;
  onSplit(): void;
  onCopy(): void;
  extra?: ReactNode;
}): JSX.Element {
  const { e, on } = props;
  const stop = (ev: MouseEvent): void => ev.stopPropagation();
  return (
    <div className="rtools" onClick={stop}>
      <Toggle size="sm" on={on} title={on ? `Switch ${e.name} off` : `Switch ${e.name} on`} onChange={props.onToggle} />
      <span className="rswl">{on ? "On" : props.offWords}</span>
      {props.extra}
      <span className="grow" />
      <span className="ract">
        <Button size="sm" title={`Split ${e.name} into two`} onClick={props.onSplit}>Split</Button>
        <Button size="sm" title={`Make a copy of ${e.name}`} onClick={props.onCopy}>Copy</Button>
      </span>
      <ContextMenuButton name={e.name} className="rmore" />
    </div>
  );
}

/**
 * One art `<img>` shape, reused by every cover below: absolutely fills its own (already relatively
 * or absolutely positioned) container, mirrors that container's own CSS `background-position` as
 * `objectPosition` since the CSS in `rc-styles.ts` was written for a background image on the div,
 * not an `<img>` it does not know about, and stays out of the card's click/drag handling.
 */
function CoverArt({ ctx, e, objectPosition }: { ctx: DeckViewContext; e: StudioEntitySummary; objectPosition: string }): JSX.Element {
  const { ref, src } = useArtSrc(versionedArtUrl(ctx, e));
  return (
    <img
      ref={ref}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition, pointerEvents: "none" } as CSSProperties}
    />
  );
}

/** The dialect a sampler set came from, in small text under its name. */
const SAMPLER_DIALECT = { kobold: "KoboldAI", textgen: "TextGen", novelai: "NovelAI" } as const;

/**
 * ContentPresetCard: the sampler strip, the prompt count, a cover ONLY when the preset carries art
 * (RC draws none otherwise), the icon box and Cinzel title, its words and tags.
 */
export function PresetCard(props: CardProps): JSX.Element {
  const { ctx, e, now } = props;
  const edition = ctx.sourceLabel(e);
  const art = ctx.portraitUrl(e);
  return (
    <CardShell {...props} className="rpreset" nameClass="rptitle">
      {(peek, name) => {
        const s = peek?.samplers;
        const stats = [
          s?.temperature !== undefined ? ["Temp", String(s.temperature)] : null,
          s?.topP !== undefined ? ["Top P", String(s.topP)] : null,
          s?.topK !== undefined ? ["Top K", String(s.topK)] : null,
        ].filter((x): x is string[] => x !== null);
        return (
          <>
            <div className="rstrip">
              {stats.map(/* bounded-ok: fixed app / doc / deck-kind / store sets, or short per-import summaries */ ([label, value]) => (
                <span className="rstat" key={label}><b>{value}</b><span>{label}</span></span>
              ))}
              <span className="grow" />
              {edition && <span className="red">{edition}</span>}
            </div>
            {peek?.blocks !== undefined && (
              <div className="rstrip">
                <span className="rstat p"><b>{peek.blocks}</b><span>{peek.blocks === 1 ? "Prompt" : "Prompts"}</span></span>
              </div>
            )}
            {art && <div className="rpcover"><CoverArt ctx={ctx} e={e} objectPosition="center" /></div>}
            <div className="rpbody">
              <div className="rphead">
                <div className="rpicon"><Icon svg={deckMeta(e.kind).glyph} /></div>
                <div className="rphead-tx">
                  <div className="rplabel">{peek?.samplerSet ? "Sampler set" : deckMeta(e.kind).singular}</div>
                  {name}
                </div>
              </div>
              {peek?.description && <div className="rpdesc">{peek.description}</div>}
              {peek?.samplerSet && <div className="rtags"><span className="rtag">{SAMPLER_DIALECT[peek.samplerSet]}</span></div>}
              {peek?.tags && (
                <div className="rtags">{peek.tags.slice(0, 4).map((t) => <span className="rtag" key={t}>{t}</span>)}</div>
              )}
              <Foot e={e} now={now} facts={[importedAgo(e.importedAt, now), peek?.tokens ? `~${tokenLabel(peek.tokens)} tokens` : null]} />
            </div>
          </>
        );
      }}
    </CardShell>
  );
}

/**
 * AssetCard (RC's library AssetCard, vertical, a fixed 520px): lorebooks get the square book cover
 * (their art, or the spined placeholder with the entry count) and the shelf tools; other decks show
 * art only when they carry some. Then the stats strip, icon and Cinzel title, words, and footer.
 */
export function AssetCard(props: CardProps): JSX.Element {
  const { ctx, e, meta, now } = props;
  const facts = cardFacts(e, meta);
  const art = ctx.portraitUrl(e);
  const edition = ctx.sourceLabel(e);
  const book = e.kind === "lorebook";
  const cover = book ? ctx.bookCover?.(e) : null;
  const lore = book ? ctx.loreShelf : undefined;
  const on = lore ? lore.enabledOf(e) : !facts.off;
  return (
    <CardShell {...props} className={`rasset${book ? " book" : ""}${on ? "" : " off"}`} nameClass="ratitle"
      onMerge={lore ? (into, from) => lore.onMerge(into, from) : undefined}>
      {(peek, name) => {
        const words = facts.words ?? (e.kind === "promptformat" ? promptFormatWords(peek?.formatParts) : peek?.description);
        const stats = [...facts.stats, ...(peek?.tokens ? [{ label: "Tokens", value: tokenLabel(peek.tokens) }] : [])];
        return (
          <>
            {(book || art) && (
              <div className={`rart${art ? " has" : ""}`}>
                {cover ? <BookCover title={e.name} choice={cover} /> : art ? <CoverArt ctx={ctx} e={e} objectPosition="center top" /> : <span className="rglyph"><Icon svg={deckMeta(e.kind).glyph} /></span>}
                {book && ctx.bookFrameUrl && <span className="rthemeframe" aria-hidden="true" style={{ "--theme-frame-mask": `url("${ctx.bookFrameUrl}")` } as CSSProperties} />}
                {!art && !cover && facts.pill && <span className="rpill">{facts.pill}</span>}
                {!on && <span className="roff">off</span>}
              </div>
            )}
            {stats.length > 0 && (
              <div className="rstats">
                {stats.map(/* bounded-ok: fixed app / doc / deck-kind / store sets, or short per-import summaries */ (s) => <span key={s.label}>{s.label}<b>{s.value}</b></span>)}
              </div>
            )}
            <div className="rahead">
              <div className="raicon"><Icon svg={deckMeta(e.kind).glyph} /></div>
              <div className="rahead-tx">
                {name}
                <div className="rameta">{[importedAgo(e.importedAt, now), edition].filter(Boolean).join(" · ") || deckMeta(e.kind).blurb}</div>
              </div>
            </div>
            {words && <div className="rabody">{words}</div>}
            {lore ? (
              <Tools e={e} on={on} offWords="Off, skipped on export" onToggle={(next) => lore.onToggleEnabled(e, next)}
                onSplit={() => lore.onSplit(e)} onCopy={() => lore.onDuplicate(e)} />
            ) : (
              <Foot e={e} now={now} left={e.provenance ?? null} />
            )}
          </>
        );
      }}
    </CardShell>
  );
}

/**
 * The regex card: RC's ContentRegexCard content (the rules-on header, what the set does) in the SAME
 * shell and Cinzel title as every other card. RC's own was a quiet thin-bordered card; beside the
 * others it read as a different app. Plus the Sets shelf's tools (switch, Split, Copy, slow flag,
 * drop onto another set to merge).
 */
export function RegexCard(props: CardProps): JSX.Element {
  const { ctx, e, meta, now } = props;
  const facts = cardFacts(e, meta);
  const edition = ctx.sourceLabel(e);
  const rgx = ctx.regexShelf;
  const total = rgx?.ruleCountOf(e);
  const onCount = rgx?.enabledRuleCountOf(e);
  const slow = rgx?.slowCountOf(e) ?? 0;
  const on = rgx ? rgx.enabledOf(e) : !facts.off;
  return (
    <CardShell {...props} className={`rregex${on ? "" : " off"}`} nameClass="ratitle"
      onMerge={rgx ? (into, from) => rgx.onMerge(into, from) : undefined}>
      {(peek, name) => {
        const words = (rgx?.doesWhatOf(e) || undefined) ?? facts.words ?? peek?.description;
        return (
          <>
            <div className="rrhead">
              {total !== undefined && (
                <span className="rrules">{onCount !== undefined ? `${String(onCount)} of ${String(total)} rules on` : `${String(total)} rules`}</span>
              )}
              {edition && <span className="rrfmt">{edition}</span>}
            </div>
            <div className="rrbody">
              {name}
              <div className="rrdate">{importedAgo(e.importedAt, now) ?? "Regex set"}</div>
              {words && <p className="rrdesc">{words}</p>}
            </div>
            {rgx ? (
              <Tools e={e} on={on} offWords="Off, skipped on export" onToggle={(next) => rgx.onToggleEnabled(e, next)}
                onSplit={() => rgx.onSplit(e)} onCopy={() => rgx.onDuplicate(e)}
                extra={slow > 0 ? <span className="rslow" title="Rules whose patterns may run slowly on long chats">{`${String(slow)} slow`}</span> : null} />
            ) : (
              <Foot e={e} now={now} />
            )}
          </>
        );
      }}
    </CardShell>
  );
}

/**
 * ContentCharacterCard (RC's DiscoveryCharacterCardV3 in library mode), for characters and
 * personas: a tall portrait card, the art filling the top and fading out at the bottom, then the
 * name in Cinzel and the tagline in italic quotes, and a footer with what the studio knows. A
 * persona adds the persona shelf's facts: the default badge, pronouns, sections, a lorebook.
 */
export function CharacterCard(props: CardProps): JSX.Element {
  const { ctx, e, meta, now } = props;
  const art = ctx.portraitUrl(e);
  const edition = ctx.sourceLabel(e);
  const facts = cardFacts(e, meta);
  const ps = e.kind === "persona" ? ctx.personaShelf : undefined;
  const pronouns = ps?.pronounsOf(e) ?? facts.stats.find((s) => s.label === "Pronouns")?.value;
  const isDefault = Boolean(ps && ps.defaultId !== "" && ps.defaultId === e.id);
  const start = e.kind === "character" ? ctx.onStartScene : undefined;
  return (
    <>
    <CardShell {...props} className="rchar" nameClass="rctitle">
      {(peek, name) => {
        const line = peek?.tagline ?? ps?.briefOf(e) ?? facts.words;
        const sections = ps?.sectionCountOf(e);
        const footFacts = e.kind === "persona"
          ? [sections !== undefined ? plural(sections, "section") : null, ps?.hasLorebookOf(e) ? "has a lorebook" : null]
          : [peek?.filled ? `${peek.filled} fields` : null, peek?.tokens ? `~${tokenLabel(peek.tokens)} tokens` : null];
        return (
          <>
            <div className="rcart">
              <div className="rcimg">
                {art && <CoverArt ctx={ctx} e={e} objectPosition="center top" />}
                {!art && <span>{e.name.charAt(0).toUpperCase()}</span>}
              </div>
            </div>
            <div className="rcbody">
              {(isDefault || edition || pronouns) && (
                <div className="rcbadges">
                  {isDefault && <span className="rcdef">Default</span>}
                  {edition && <span className="rcgenre">{edition}</span>}
                  {pronouns && <span className="rcorigin">{pronouns}</span>}
                </div>
              )}
              {name}
              {line && <p className="rcline">{`"${line}"`}</p>}
              <Foot e={e} now={now} facts={[...footFacts, importedAgo(e.importedAt, now)]} />
            </div>
          </>
        );
      }}
    </CardShell>
    {start && (
      <div className="rstart">
        <Button block variant="primary" icon="lucide:play" onClick={() => start(e)} title={`Start a new scene with ${e.name}`}>
          Start Scene
        </Button>
      </div>
    )}
    </>
  );
}

/** The card a deck's pieces wear, as RC's library rows choose it. */
export function cardFor(kind: string): (props: CardProps) => JSX.Element {
  if (deckOf(kind) === "preset") return PresetCard;
  if (kind === "character" || kind === "persona") return CharacterCard;
  if (kind === "regex") return RegexCard;
  return AssetCard;
}
