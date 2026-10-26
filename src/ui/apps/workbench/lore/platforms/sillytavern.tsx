/**
 * SillyTavern lore long tail: scan surface, match/groups, editor chrome, character filter.
 * Codec: formats/sillytavern/lorebook.ts. Layout: design/vs-lore-platform-extras.html pass 3.2.
 */
import { Chip, Toggle } from "../../../../components/button";
import type { JSX } from "react";
import { fieldOr, useFramed } from "../../framed";
import type { LorePlatformCard, LorePlatformCardProps } from "./card-contract";
import { CharacterFilterBlock } from "./filter-block";

const SCAN_KEYS = [
  ["scanCharacterDescription", "Description"],
  ["scanCharacterPersonality", "Personality"],
  ["scanUserPersona", "Persona"],
  ["scanScenario", "Scenario"],
  ["scanCharacterDepthPrompt", "Depth prompt"],
  ["scanCreatorNotes", "Creator notes"],
] as const;

function Component({ entry, show, styles, onPatch }: LorePlatformCardProps): JSX.Element | null {
  const themed = useFramed();
  const any =
    show("scanSources") ||
    show("vectorized") ||
    show("groupTuning") ||
    show("displayIndex") ||
    show("automationId") ||
    show("characterFilter");
  if (!any) return null;

  const scanOn = SCAN_KEYS.filter(([key]) => entry[key] === true).length;

  return (
    <>
      {show("scanSources") && (
        <div className={styles.pcZone}>
          <div className={styles.pcZh}>
            <b>Also scan</b>
            <span>where keys look beyond the chat</span>
            <em>
              {scanOn} of {SCAN_KEYS.length}
            </em>
          </div>
          <div className={styles.pcScanGrid}>
            {SCAN_KEYS.map(([key, label]) => {
              const on = entry[key] === true;
              return (
                <Chip key={key} pressed={on} onClick={() => onPatch({ [key]: on ? false : true })}>
                  <span className={styles.pcScanBox} aria-hidden="true" />
                  {label}
                </Chip>
              );
            })}
          </div>
        </div>
      )}

      {(show("vectorized") || show("groupTuning")) && (
        <div className={styles.pcZone}>
          <div className={styles.pcZh}>
            <b>Match &amp; groups</b>
            <span>how this entry competes when several want in</span>
          </div>
          <div className={styles.pcPair}>
            {show("vectorized") && (
              <div className={styles.pcCell}>
                <div className={styles.pcCellT}>
                  <b>Vectorized</b>
                  <span>RAG / by meaning instead of exact keys.</span>
                </div>
                <Toggle size="sm" on={entry.vectorized === true} aria-label="Vectorized (RAG)" onChange={() =>
                    onPatch({ vectorized: entry.vectorized === true ? false : true })
                  } />
              </div>
            )}
            {show("groupTuning") && (
              <>
                <div className={styles.pcCell}>
                  <div className={styles.pcCellT}>
                    <b>Group override</b>
                    <span>Always wins its inclusion group.</span>
                  </div>
                  <Toggle size="sm" on={entry.groupOverride === true} aria-label="Group override" onChange={() =>
                      onPatch({
                        // explicit false clears the ST wire flag (undefined leaves a twin on)
                        groupOverride: entry.groupOverride === true ? false : true,
                      })
                    } />
                </div>
                <div className={`${styles.pcCell} ${styles.pcCellWide}`}>
                  <div className={styles.pcCellT}>
                    <b>Group scoring</b>
                    <span>Pick the group winner by match score, not weight.</span>
                  </div>
                  <Toggle size="sm" on={entry.useGroupScoring === true} aria-label="Group scoring" onChange={() =>
                      onPatch({
                        useGroupScoring: entry.useGroupScoring === true ? false : true,
                      })
                    } />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {(show("displayIndex") || show("automationId")) && (
        <div className={styles.pcZone}>
          <div className={styles.pcZh}>
            <b>Editor chrome</b>
            <span>list order and automation bind</span>
          </div>
          <div className={styles.pcChrome}>
            {show("displayIndex") && fieldOr(themed, { label: "List index" }, (
                <input
                  className={themed ? undefined : styles.pcNum}
                  type="number"
                  value={entry.displayIndex ?? ""}
                  placeholder="-"
                  aria-label="List display index (blank follows order)"
                  onChange={(ev) => {
                    const v = ev.target.value;
                    onPatch({ displayIndex: v === "" ? null : Number(v) || 0 });
                  }}
                />
            ), (c) => (<><span className={styles.pcK}>List index</span>{c}</>))}
            {show("automationId") && fieldOr(themed, { label: "Automation" }, (
                <input
                  className={styles.pcText}
                  style={{ width: "100%", maxWidth: "none" }}
                  value={entry.automationId ?? ""}
                  placeholder="quick-reply id"
                  aria-label="Automation id"
                  onChange={(ev) => onPatch({ automationId: ev.target.value || null })}
                />
            ), (c) => (<><span className={styles.pcK}>Automation</span>{c}</>))}
          </div>
        </div>
      )}

      {show("characterFilter") && <CharacterFilterBlock entry={entry} styles={styles} onPatch={onPatch} />}
    </>
  );
}

const card: LorePlatformCard = {
  id: "sillytavern",
  label: "SillyTavern",
  lenses: ["sillytavern"],
  Component,
};

export default card;
