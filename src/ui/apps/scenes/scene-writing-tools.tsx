/**
 * The Prompting wing's Writing Tools tab: RoleCall's WritingToolsPanel on Bunraku. Every built tool that
 * rewrites a reply or drafts yours (the table in writing-tools-core.ts, also read by the composer and
 * message menus), grouped, each with the prompt it uses. A tool whose prompt is a preset field edits it
 * here through the wing's one text writer, the same field the Preset tab's Templates section edits; what
 * a request holds that is not a preset field is shown read-only under "What this sends" (RoleCall's tab
 * shows only the two preset fields and hides the rest). The row copy is RoleCall's.
 */
import { useState, type JSX } from "react";
import { Ic, type IconName } from "../../_shared/ic";
import { SystemPromptItem } from "./scene-preset-templates";
import { TEMPLATE_FIELDS } from "./preset-core";
import type { PresetText } from "./use-scene-preset-text";
import { TOOL_SECTIONS, toolsIn, type ToolSectionId, type WritingTool } from "./writing-tools-core";
import { Disclosure } from "../../components/button";

const ICONS: Readonly<Record<ToolSectionId, IconName>> = { reply: "lucide:refresh-cw", character: "lucide:drama", draft: "lucide:wand-sparkles" };
/** RoleCall opens "Change the reply" and "Write in character", and keeps "Your draft" closed. */
const OPEN: Readonly<Record<ToolSectionId, boolean>> = { reply: true, character: true, draft: false };

/** The prompt a tool uses: its editor, or why there is none to edit. */
function ToolPrompt({ tool, text }: { tool: WritingTool; text: PresetText }): JSX.Element {
  const label = TEMPLATE_FIELDS.find((f) => f.key === tool.promptKey)!.label;
  const { loaded } = text;
  return (
    <div className="wt-prompt">
      <div className="wt-uses">Uses this prompt: <b>{label}</b> · saved in your preset</div>
      {tool.promptNote && <div className="wt-uses">{tool.promptNote}</div>}
      {loaded.state === "ready" ? <SystemPromptItem field={tool.promptKey!} body={loaded.entity.body} text={text} />
        : loaded.state === "loading" ? <p className="wt-none">Loading the preset...</p>
        : loaded.state === "failed" ? <p className="wt-none">The preset could not be read: {loaded.why}.</p>
        : <p className="wt-none">Choose a preset to edit this prompt.</p>}
    </div>
  );
}

function Tool({ tool, text }: { tool: WritingTool; text: PresetText }): JSX.Element {
  const [sends, setSends] = useState(false);
  return (
    <li className="wt-tool" data-part={`scene.prompting.tools.tool.${tool.id}`}>
      <div className="wt-line"><b className="wt-name">{tool.label}</b>{tool.shortcut && <span className="wt-chip">{tool.shortcut}</span>}</div>
      <p className="wt-desc">{tool.description}</p>
      {tool.promptKey && <ToolPrompt tool={tool} text={text} />}
      {tool.sends && (
        <>
          <Disclosure variant="line" data-part="scene.prompting.tools.sends" open={sends} onClick={() => setSends(!sends)} label="What this sends" />
          {sends && <p className="wt-sends-text">{tool.sends}</p>}
        </>
      )}
    </li>
  );
}

export function SceneWritingTools({ text }: { text: PresetText }): JSX.Element {
  const [open, setOpen] = useState<Readonly<Record<string, boolean>>>(OPEN);
  return (
    <div className="wbody pp wt" data-part="scene.prompting.tools">
      <div className="pp-top">
        <header className="hero">
          <span className="hi"><Ic name="lucide:pencil" size={20} /></span>
          <div><div className="eb">Your turn helpers</div><h2>Writing <em>Tools</em></h2><p>Every tool that rewrites a reply or drafts yours, with the prompt it uses. The &quot;+&quot; menu and message menu run these same tools.</p></div>
        </header>
      </div>
      <div className="wt-body">
      {TOOL_SECTIONS.map((section) => {
        const tools = toolsIn(section.id);
        if (tools.length === 0) return null;
        return (
          <section key={section.id} className="wt-group" data-part={`scene.prompting.tools.section.${section.id}`}>
            <Disclosure open={open[section.id] === true} onClick={() => setOpen({ ...open, [section.id]: !open[section.id] })}
              leading={<Ic name={ICONS[section.id]} size={16} />} label={section.label} summary={`${tools.length} ${tools.length === 1 ? "tool" : "tools"}`} />
            {open[section.id] && <ul className="wt-tools">{tools.map(/* bounded-ok: fixed option / param / prop sets, chips and per-item detail */ (t) => <Tool key={t.id} tool={t} text={text} />)}</ul>}
          </section>
        );
      })}
      <p className="wt-foot">The prompts stay saved in the preset. This tab edits the same fields as Preset, so the two never disagree.</p>
      </div>
    </div>
  );
}
