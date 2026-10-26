/**
 * NovelAI lore long tail: activation, phrase bias, context wrap, budget, trim/join policy.
 * Layout: design/vs-lore-platform-extras.html pass 3.2. Codec: formats/novelai/lorebook.ts.
 */
import { Fragment, type JSX } from "react";
import { patchContextConfig } from "../entry-extras";
import { fieldOr, useFramed } from "../../framed";
import type { LorePlatformCard, LorePlatformCardProps } from "./card-contract";
import { NovelAiBiasBlock } from "./novelai-bias";
import { Toggle } from "../../../../components/button";

const openOptions = (known: readonly string[], current: string | undefined): string[] =>
  current && !known.includes(current) ? [...known, current] : [...known];

function Component({ entry, show, styles, onPatch }: LorePlatformCardProps): JSX.Element | null {
  const themed = useFramed();
  const cc = entry.contextConfig;
  const patchCc = (patch: Parameters<typeof patchContextConfig>[1]): void =>
    onPatch({ contextConfig: patchContextConfig(cc, patch) });

  const any = show("naiActivation") || show("contextConfig") || show("phraseBias");
  if (!any) return null;

  return (
    <>
      {show("naiActivation") && (
        <div className={styles.pcZone}>
          <div className={styles.pcZh}>
            <b>Activation</b>
            <span>when keys are allowed to fire</span>
          </div>
          <div className={styles.pcPair}>
            <div className={styles.pcCell}>
              <div className={styles.pcCellT}>
                <b>Key-relative</b>
                <span>Keys match near this entry's insertion, not only the story tail.</span>
              </div>
              <Toggle size="sm" on={entry.keyRelative === true} aria-label="Keys match near the entry" onChange={() =>
                  onPatch({ keyRelative: entry.keyRelative === true ? undefined : true })
                } />
            </div>
            <div className={styles.pcCell}>
              <div className={styles.pcCellT}>
                <b>Non-story</b>
                <span>Can activate outside story text (UI and other sources).</span>
              </div>
              <Toggle size="sm" on={entry.nonStoryActivatable === true} aria-label="Can activate outside story text" onChange={() =>
                  onPatch({
                    nonStoryActivatable: entry.nonStoryActivatable === true ? undefined : true,
                  })
                } />
            </div>
          </div>
        </div>
      )}

      {show("phraseBias") && (
        <NovelAiBiasBlock entry={entry} styles={styles} onPatch={onPatch} />
      )}

      {show("contextConfig") && (
        <>
          <div className={styles.pcZone}>
            <div className={styles.pcZh}>
              <b>Context wrap</b>
              <span>text that frames the passage</span>
            </div>
            <div className={styles.pcWrap}>
              {fieldOr(themed, { label: "Prefix" }, (
                <input
                  className={styles.pcText}
                  style={{ width: "100%", maxWidth: "none", marginTop: "0.16rem" }}
                  value={cc?.prefix ?? ""}
                  aria-label="Context prefix"
                  onChange={(ev) => patchCc({ prefix: ev.target.value || undefined })}
                />
              ), (c) => (
                <div>
                  <span className={styles.pcWrapLab}>Prefix</span>
                  {c}
                </div>
              ))}
              <div className={styles.pcWrapMid}>the entry passage sits here</div>
              {fieldOr(themed, { label: "Suffix" }, (
                <input
                  className={styles.pcText}
                  style={{ width: "100%", maxWidth: "none", marginTop: "0.16rem" }}
                  value={cc?.suffix ?? ""}
                  aria-label="Context suffix"
                  onChange={(ev) => patchCc({ suffix: ev.target.value || undefined })}
                />
              ), (c) => (
                <div>
                  <span className={styles.pcWrapLab}>Suffix</span>
                  {c}
                </div>
              ))}
            </div>
          </div>

          <div className={styles.pcZone}>
            <div className={styles.pcZh}>
              <b>Budget</b>
              <span>how much room this entry may take</span>
            </div>
            <div className={styles.pcTrio}>
              {fieldOr(themed, { label: "Token cap" }, (
                <input
                  className={themed ? undefined : styles.pcNum}
                  type="number"
                  value={cc?.tokenBudget ?? ""}
                  placeholder="-"
                  aria-label="Token cap"
                  onChange={(ev) =>
                    patchCc({
                      tokenBudget: ev.target.value === "" ? undefined : Number(ev.target.value) || 0,
                    })
                  }
                />
              ), (c) => (
                <label className={styles.pcTrioCell}>
                  <span className={styles.pcK}>Token cap</span>
                  {c}
                </label>
              ))}
              {fieldOr(themed, { label: "Reserved" }, (
                <input
                  className={themed ? undefined : styles.pcNum}
                  type="number"
                  value={cc?.reservedTokens ?? ""}
                  placeholder="0"
                  aria-label="Reserved tokens"
                  onChange={(ev) =>
                    patchCc({
                      reservedTokens:
                        ev.target.value === "" ? undefined : Number(ev.target.value) || 0,
                    })
                  }
                />
              ), (c) => (
                <label className={styles.pcTrioCell}>
                  <span className={styles.pcK}>Reserved</span>
                  {c}
                </label>
              ))}
              {fieldOr(themed, { label: "Offset" }, (
                <input
                  className={themed ? undefined : styles.pcNum}
                  type="number"
                  value={cc?.insertionPosition ?? ""}
                  placeholder="0"
                  aria-label="Insertion offset"
                  onChange={(ev) =>
                    patchCc({
                      insertionPosition:
                        ev.target.value === "" ? undefined : Number(ev.target.value) || 0,
                    })
                  }
                />
              ), (c) => (
                <label className={styles.pcTrioCell}>
                  <span className={styles.pcK}>Offset</span>
                  {c}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.pcZone}>
            <div className={styles.pcZh}>
              <b>Trim &amp; join</b>
              <span>assembly policy when room is tight</span>
            </div>
            <div className={styles.pcTrio}>
              {(
                [
                  ["trimDirection", "Trim direction", ["doNotTrim", "trimBottom", "trimTop"]],
                  ["insertionType", "Join by", ["newline", "space", "token"]],
                  ["maximumTrimType", "Trim by", ["sentence", "newline", "token"]],
                ] as const
              ).map(([key, label, known]) => (
                <Fragment key={key}>
                  {fieldOr(themed, { label }, (
                  <select
                    className={styles.pcSel}
                    value={cc?.[key] ?? ""}
                    aria-label={label}
                    onChange={(ev) => patchCc({ [key]: ev.target.value || undefined })}
                  >
                    <option value="">default</option>
                    {openOptions(known, cc?.[key]).map(/* bounded-ok: tabs, ports, options, chips and per-item detail inside one document */ (o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  ), (c) => (
                    <label className={styles.pcTrioCell}>
                      <span className={styles.pcK}>{label}</span>
                      {c}
                    </label>
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

const card: LorePlatformCard = {
  id: "novelai",
  label: "NovelAI",
  lenses: ["novelai"],
  Component,
};

export default card;
