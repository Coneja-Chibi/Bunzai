/**
 * MacroReference - the AVAILABLE MACROS section of the EDIT PROMPT sidebar (a faithful port of RC's
 * MacroReferenceDropdown): a "Click to copy" header, bordered collapsible group boxes (icon + name +
 * count + chevron), and, when expanded, the group description over a wrapping grid of macro pills.
 * Clicking a pill copies its token (green "Copied" state, then reverts). Which GROUPS appear is
 * capability-driven: the caller passes the groups the selected Write-for lens supports
 * (macroGroupsForProfile), so RC/Bunraku show the whole engine while SillyTavern/Marinara show only
 * what they can run - the "different options per app" the fixed RC panel can't do.
 */
import { useState, type JSX } from "react";
import { Ic, type IconName } from "../../../_shared/ic";
import type { MacroGroup } from "../../../../core/preset";
import { copyText } from "../../../_shared/clipboard";
import { FLASH_MS, useFlash } from "../../../_shared/use-flash";
import s from "./macro.module.css";

const GROUP_ICONS: Record<string, IconName> = {
  Identity: "lucide:user",
  "Character Card": "lucide:id-card",
  "Chat Context": "lucide:message-square",
  "Time & Date": "lucide:clock",
  Variables: "lucide:variable",
  "Advanced Syntax": "lucide:braces",
  "Random & Dice": "lucide:dices",
  "Text Processing": "lucide:type",
  Conditionals: "lucide:git-branch",
  Pronouns: "lucide:users",
  "Runtime & Stats": "lucide:settings",
  "Roleplay & Game": "lucide:swords",
  Lorebook: "lucide:book-open",
};

export interface MacroReferenceProps {
  groups: MacroGroup[];
}

export function MacroReference({ groups }: MacroReferenceProps): JSX.Element {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const { value: copied, flash } = useFlash<string>(FLASH_MS.copy);

  const toggle = (name: string): void =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const copy = (macro: string): void => {
    void copyText(macro).then((ok) => { if (ok) flash(macro); });
  };

  return (
    <div className={s.macros}>
      <div className={s.macrosHead}>
        <span className={s.macrosLabel}>Available macros</span>
        <span className={s.macrosHint}>Click to copy</span>
      </div>

      <div className={s.macroScroll}>
        {groups.map((g) => {
          const isOpen = open.has(g.name);
          const icon = GROUP_ICONS[g.name] ?? "lucide:hash";
          return (
            <div key={g.name} className={s.macroGroup}>
              <button type="button" className={s.macroHead} aria-expanded={isOpen} onClick={() => toggle(g.name)}>
                <span className={s.macroHeadLeft}>
                  <Ic name={icon} size={14} className={s.macroIcon} />
                  <span className={s.macroName}>{g.name}</span>
                  <span className={s.macroCount}>({g.macros.length})</span>
                </span>
                <Ic name={isOpen ? "lucide:chevron-up" : "lucide:chevron-down"} size={14} className={s.macroChev} />
              </button>

              {isOpen && (
                <div className={s.macroBody}>
                  <p className={s.macroGroupDesc}>{g.description}</p>
                  <div className={s.macroPills}>
                    {g.macros.map((m) => {
                      const isCopied = copied === m.macro;
                      return (
                        <button
                          key={m.macro}
                          type="button"
                          className={`${s.macroPill} ${isCopied ? s.macroPillCopied : ""}`}
                          title={m.example ? `${m.description}\nExample: ${m.example}` : m.description}
                          onClick={() => copy(m.macro)}
                        >
                          {isCopied ? (
                            <span className={s.macroPillCopiedInner}>
                              <Ic name="lucide:check" size={12} />
                              Copied
                            </span>
                          ) : (
                            m.macro
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
