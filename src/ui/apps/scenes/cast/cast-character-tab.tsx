/**
 * The Cast wing's Character tab (approved wireframe; RoleCall's CharacterPanel): the hero, the tall
 * portrait with the Now Playing chip, version badge and alt-art look strip, and the form in RoleCall's
 * order: the casting card, the Color Palette, Description, Personality, Scenario, First Message, Example
 * Dialogue, Advanced (system prompt, post-history, creator notes), the content rating, tags (Open
 * Tagsheet), the Lorebooks section and Open Full Editor. Every field is a canonical card field written through the Workbench's own draft and
 * save path (use-cast-editor.ts), so what the page does not show is never touched.
 */
import type { JSX } from "react";
import type { AppContext } from "../../../app-contract";
import type { CharacterVariant } from "../../../../entities/character/schema";
import { isPreviewablePortraitRef } from "../../../../core/media";
import { useArtSrc, usePieceArtIdentity, usePortraitAsset } from "../../../_shared/art-cache";
import { portraitUrl } from "../../../_shared/asset-url";
import { readPath, writePath } from "../../workbench/editor-core";
import { str } from "../../workbench/editor-derive";
import { NamedSwatches, ThemeSwatches, type NamedSwatch } from "./cast-palette";
import { resolveCssColor } from "../../../_shared/css-color";
import { useScopedAccents } from "../../../_shared/use-scoped-accents";
import { pieceAccent } from "../../../../studio/summary";
import { CastFooter, CastHero, CastPortrait, FormSection, LineField, ProseSection } from "./cast-parts";
import { RatingSection, TagsSection } from "./cast-rating-tags";
import { LorebooksSection } from "./cast-lorebooks";
import type { CastEditor } from "./use-cast-editor";
import { strArray } from "../../../../core/guards";

type Body = Record<string, unknown>;

/** The Character tab: the card's fields in RoleCall's order, the look strip, and the pinned Save. */
export function CharacterForm({ ctx, id, chatId, editor, summary, art, version, variants, variantId, busy, onVariant }: {
  ctx: AppContext;
  id: string;
  chatId: string;
  editor: CastEditor<Body>;
  summary: { version?: number; writeId?: number; revision?: string; hasPortrait?: boolean } | undefined;
  /** the accent stamped from the stored card's portrait (summary.ts artAccentOf): the colour an unsigned card wears */
  art?: string;
  /** the card version this scene plays, for the badge */
  version: number;
  /** the looks the scene's own copy of the card carries */
  variants: readonly CharacterVariant[];
  variantId: string | undefined;
  busy: boolean;
  onVariant(id: string | null): void;
}): JSX.Element {
  const { body, edit } = editor;
  const signature = pieceAccent({ body }, art);
  const accents = useScopedAccents({ character: signature });
  const get = (path: string): string => str(readPath(body, path));
  const set = (path: string) => (value: unknown): void => edit((b) => writePath(b, path, value), path.split(".")[0]!);
  const gradient = strArray(readPath(body, "presentation.gradientColors"));
  const palette = (readPath(body, "presentation.palette") as NamedSwatch[] | undefined) ?? [];
  const tags = strArray(readPath(body, "discovery.tags"));
  const name = get("identity.name");
  const portraitRef = str(readPath(body, "media.portrait.ref"));
  const draft = isPreviewablePortraitRef(portraitRef) ? portraitRef : null;
  const draftArt = useArtSrc(draft);
  const identity = usePieceArtIdentity(ctx.pieces, "character", id, summary?.writeId ?? 0, summary?.revision ?? "");
  const storedArt = usePortraitAsset("character", id, summary?.version, !draft && summary?.hasPortrait ? portraitUrl("character", id) : null, identity);
  const src = draft ? draftArt.src : storedArt.src;
  const ref = draft ? draftArt.ref : storedArt.ref;
  const swatch = gradient.length < 2 ? signature ?? "transparent" : `linear-gradient(135deg, ${gradient.join(", ")})`;

  return (
    <div className="cw cw-character" data-part="scene.cast.character" style={accents}>
      <CastHero icon="mdi:drama-masks" eyebrow="Edit character" title="Identity &" emphasis="Details" sub="Stage name, casting card, prompts, lorebooks: every page in this character's dossier." />
      <div className="cw-body">
        <CastPortrait
          art={src ? <img ref={ref as never} src={src} alt={name} /> : null}
          standIn={name.charAt(0).toUpperCase() || "?"}
          chip="Now playing" name={name || "Unnamed Character"}
          upload={editor.uploads.uploadAsset}
          onPick={(asset) => edit((b) => writePath(b, "media.portrait", asset), "media")}
          lines={<>
            {get("identity.tagline") && <p className="cw-tg">{get("identity.tagline")}</p>}
            <div className="badges"><span className="vb" title="The version of the card this scene plays">V{version}</span></div>
            {variants.length > 0 && (
              <div className="vth" data-part="scene.cast.variants" role="group" aria-label="Looks">
                <button type="button" className={!variantId ? "on" : undefined} aria-pressed={!variantId} disabled={busy} title="Original" onClick={() => onVariant(null)}>Base</button>
                {variants.map((v) => (
                  <button type="button" key={v.id} className={variantId === v.id ? "on" : undefined} aria-pressed={variantId === v.id} disabled={busy} title={v.label ?? v.id} onClick={() => onVariant(v.id)}>
                    {(v.label ?? "?").slice(0, 5)}
                  </button>
                ))}
              </div>
            )}
          </>}
        />
        <div className="cw-form">
          <div className="cw-scroll">
            <section className="cw-card" data-part="scene.cast.identity">
              <div className="idr">
                <div className="theme"><span className="sw0" style={{ background: swatch }} /><span className="lb">Theme</span></div>
                <div className="names">
                  <LineField label="Stage name" tone="big" value={name} placeholder="Character name..." onChange={set("identity.name")} />
                  <LineField label="Full name" tone="line" value={get("identity.fullName")} placeholder="Legal or birth name..." onChange={set("identity.fullName")} />
                </div>
              </div>
              <LineField label="Title / Epithet" value={get("identity.title")} placeholder="The Magnificent, Lord of..., etc." onChange={set("identity.title")} />
              <div className="pair">
                <LineField label="Age" value={get("identity.age")} placeholder="Ancient, 25, Timeless..." onChange={set("identity.age")} />
                <LineField label="Pronouns" value={get("identity.pronouns")} placeholder="He/Him, She/Her, They..." onChange={set("identity.pronouns")} />
              </div>
              <LineField label="Tagline" tone="bare" value={get("identity.tagline")} placeholder="A one-line description..." onChange={set("identity.tagline")} />
            </section>
            <FormSection title="Color Palette" icon="lucide:palette" tone="var(--accent)" note="(becomes XML tags for AI)" data-part="scene.cast.palette">
              <div className="cw-sub"><span className="lb">Signature Colors (Theme)</span><ThemeSwatches value={gradient} onChange={(rows) => set("presentation.gradientColors")(rows.length ? rows : undefined)} /></div>
              <div className="cw-sub"><span className="lb">Named Colors</span>
                <NamedSwatches value={palette} onChange={(rows) => set("presentation.palette")(rows.length ? rows : undefined)}
                  signature={{ hex: signature ?? resolveCssColor("var(--deck-character)"), name: "Theme" }} lockSignatureName signatureCaption="Signature"
                  onSignature={(s) => set("presentation.gradientColors")([s.hex, ...gradient.slice(1)])} /></div>
            </FormSection>
            <ProseSection data-part="scene.cast.description" title="Description" icon="lucide:scroll-text" tone="var(--deck-pack)" value={get("identity.description")} onChange={set("identity.description")} placeholder="Who is this character? Backstory, appearance..." />
            <ProseSection data-part="scene.cast.personality" title="Personality" icon="lucide:heart" tone="var(--deck-lorebook)" value={get("persona.personality")} onChange={set("persona.personality")} placeholder="How do they think and behave? Traits, quirks..." />
            <ProseSection data-part="scene.cast.scenario" title="Scenario" icon="lucide:clapperboard" tone="var(--deck-regex)" rows={2} value={get("persona.scenario")} onChange={set("persona.scenario")} placeholder="The setting or situation for roleplay..." />
            <ProseSection data-part="scene.cast.first-message" title="First Message" icon="lucide:message-circle" tone="var(--deck-preset)" value={get("greetings.firstMessage")} onChange={set("greetings.firstMessage")} placeholder="The opening message when a chat begins..." />
            <ProseSection data-part="scene.cast.example-dialogue" title="Example Dialogue" icon="lucide:message-square" tone="var(--deck-persona)" rows={2} value={get("examples.exampleMessages")} onChange={set("examples.exampleMessages")} placeholder="Example dialogue showing how the character speaks..." />
            <FormSection data-part="scene.cast.advanced" title="Advanced" icon="lucide:settings" tone="var(--stage-var)">
              <label className="cw-line"><span className="lb">System Prompt</span><textarea className="cw-ta" rows={2} value={get("prompts.systemPrompt")} placeholder="Custom AI instructions..." onChange={(e) => set("prompts.systemPrompt")(e.target.value)} /></label>
              <label className="cw-line"><span className="lb">Post-History Instructions</span><textarea className="cw-ta" rows={2} value={get("prompts.postHistoryInstructions")} placeholder="Instructions after chat history..." onChange={(e) => set("prompts.postHistoryInstructions")(e.target.value)} /></label>
              <label className="cw-line"><span className="lb">Creator Notes <small>(not sent to AI)</small></span><textarea className="cw-ta" rows={1} value={get("attribution.creatorNotes")} placeholder="Notes for users..." onChange={(e) => set("attribution.creatorNotes")(e.target.value)} /></label>
            </FormSection>
            <RatingSection value={get("discovery.rating") || "all-ages"} onChange={set("discovery.rating")} />
            <TagsSection tags={tags} onChange={(next) => set("discovery.tags")(next)} />
            <LorebooksSection ctx={ctx} chatId={chatId} onOpenEditor={() => ctx.workbench.open({ id, kind: "character", name: name || "Unnamed Character" })} />
          </div>
          <CastFooter dirty={editor.dirty} saving={editor.saving} busy={busy} note={editor.note} what="card" saveLabel="Save Draft" onSave={() => void editor.save()} />
        </div>
      </div>
    </div>
  );
}
