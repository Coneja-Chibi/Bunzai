/**
 * ExpressionStage - sealed local match: sample text -> pack face. No network.
 */
import { Segmented } from "../button";
import { useMemo, useState, type JSX } from "react";
import {
  matchExpression,
  normalizePack,
  resolvePackFace,
  type ExpressionProfile,
  type SpritePackValue,
} from "../../../core/media";
import { ExpandTextarea } from "../expand";
import { useArtSrc } from "../../_shared/art-cache";
import styles from "./styles.module.css";

export interface ExpressionStageProps {
  pack: SpritePackValue;
  profile?: ExpressionProfile;
}

const MOODS = ["neutral", "happy", "sad", "angry", "surprised"] as const;

export function ExpressionStage({ pack, profile }: ExpressionStageProps): JSX.Element {
  const p = normalizePack(pack);
  const [text, setText] = useState("");
  const [mood, setMood] = useState<string | null>(null);

  const hitLabel = useMemo(() => {
    if (mood) {
      const face = resolvePackFace(p, mood);
      return face?.label ?? matchExpression(mood, p, profile);
    }
    return matchExpression(text, p, profile);
  }, [text, mood, p, profile]);

  const face = resolvePackFace(p, hitLabel);

  return (
    <div className={styles.wrap}>
      <span className={styles.seal}>Sealed · local match · no network</span>
      <div className={styles.row}>
        <div className={styles.face}>
          {face?.ref ? (
            <ExpressionFace refValue={face.ref} alt={face.label} />
          ) : (
            <span>{hitLabel || "-"}</span>
          )}
          {face ? <span>{face.label}</span> : null}
        </div>
        <div>
          <div className={styles.moods}>
            <Segmented
              size="sm"
              label="Mood"
              multiple
              value={mood ? [mood as (typeof MOODS)[number]] : []}
              onChange={(picked) => {
                const m = picked.find((x) => x !== mood) ?? picked[0];
                if (!m) return;
                setMood(m);
                setText("");
              }}
              items={MOODS.map((m) => ({ value: m, label: m }))}
            />
          </div>
          <ExpandTextarea
            label="Sample line"
            className={styles.ta}
            placeholder="Sample character line…"
            value={text}
            onChange={(e) => {
              setMood(null);
              setText(e.target.value);
            }}
          />
          <div className={styles.hit}>
            Match → <b>{hitLabel ?? "none"}</b>
            {profile ? ` · ${profile.label}` : ""} · keyword
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpressionFace({ refValue, alt }: { refValue: string; alt: string }): JSX.Element {
  const asset = useArtSrc(refValue);
  return <img ref={asset.ref as (node: HTMLImageElement | null) => void} src={asset.src} alt={alt} />;
}
