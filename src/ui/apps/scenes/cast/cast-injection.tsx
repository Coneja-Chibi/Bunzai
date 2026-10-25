/**
 * The Persona tab's Prompt Injection extras, after RoleCall's PersonaPanel: the status line over the stops (the preset scan) and the
 * Live Preview with its Tokens footer. The preview is the persona block the assembler itself sends (core/assembly/persona-preview.ts),
 * counted with the scene's own counter (countText), so what it shows and counts is what a turn sends.
 */
import { useDeferredValue, useMemo, type JSX } from "react";
import type { CharacterBody } from "../../../../entities/character/schema";
import type { PersonaBody } from "../../../../entities/persona/schema";
import { personaBlock } from "../../../../core/assembly/persona-preview";
import { countText } from "../../../../core/tokens";
import { Ic } from "../../../_shared/ic";

/** What the scene's preset scan found: still reading, a block already carrying {{persona}}, or none. */
export type PresetScan = "loading" | { id: string; name: string } | null;

/** RoleCall's status over the stops: scanning, "Auto-injecting via <block>", or the plain invitation. */
export function InjectionStatus({ scan }: { scan: PresetScan }): JSX.Element {
  if (scan === "loading") return <p className="cw-scan" role="status"><Ic name="lucide:loader-circle" size={14} />Scanning preset...</p>;
  if (scan) return <p className="cw-auto" role="status"><Ic name="lucide:sparkles" size={14} />Auto-injecting via <b>{scan.name}</b></p>;
  return <p className="cw-scan">Choose where your persona appears in the prompt</p>;
}

/** RoleCall's Live Preview: the eye, where it lands, the block as sent, and the token count. */
export function LivePreview({ body, character, scan }: { body: PersonaBody; character: CharacterBody; scan: PresetScan }): JSX.Element {
  const draft = useDeferredValue(body);
  const text = useMemo(() => personaBlock(draft, character, Date.now()), [draft, character]);
  const position = body.chatInjection?.position ?? "character";
  const where = scan && scan !== "loading" ? "via {{persona}}" : `@ ${position}${position === "depth" ? ` ${body.chatInjection?.depth ?? 2}` : ""}`;
  return (
    <div className="cw-prev" data-part="scene.cast.preview">
      <div className="ph"><span><Ic name="lucide:eye" size={14} />Live Preview</span><small>{where}</small></div>
      <pre>{text}</pre>
      <div className="pf"><span>Tokens</span><b>{countText(text)}</b></div>
    </div>
  );
}
