/**
 * Pure Agnai FullSprite (flat parts + colors + gender) normalize.
 */
import { str, isRecord } from "../../../core/guards";
const SPECIALS = ["eyeColor", "bodyColor", "hairColor", "gender"] as const;

export interface SpritePartsValue {
  parts: Record<string, string>;
  gender: string;
  eyeColor: string;
  bodyColor: string;
  hairColor: string;
}


export function normalizeSprite(raw: unknown): SpritePartsValue {
  const parts: Record<string, string> = {};
  let gender = "";
  let eyeColor = "";
  let bodyColor = "";
  let hairColor = "";
  if (isRecord(raw)) {
    const r = raw;
    // Canonical Sprite shape { parts, gender, ... } or flat wire
    if (isRecord(r.parts)) {
      for (const [k, v] of Object.entries(r.parts)) {
        if (typeof v === "string") parts[k] = v;
      }
      gender = str(r.gender);
      eyeColor = str(r.eyeColor);
      bodyColor = str(r.bodyColor);
      hairColor = str(r.hairColor);
    } else {
      for (const [k, v] of Object.entries(r)) {
        if ((SPECIALS as readonly string[]).includes(k)) {
          if (k === "gender") gender = str(v);
          if (k === "eyeColor") eyeColor = str(v);
          if (k === "bodyColor") bodyColor = str(v);
          if (k === "hairColor") hairColor = str(v);
        } else if (typeof v === "string") {
          parts[k] = v;
        }
      }
    }
  }
  return { parts, gender, eyeColor, bodyColor, hairColor };
}

/** Flat wire object for Agnai FullSprite (original twin). */
export function spriteToWire(v: SpritePartsValue): Record<string, unknown> {
  const out: Record<string, unknown> = { ...v.parts };
  if (v.gender) out.gender = v.gender;
  if (v.eyeColor) out.eyeColor = v.eyeColor;
  if (v.bodyColor) out.bodyColor = v.bodyColor;
  if (v.hairColor) out.hairColor = v.hairColor;
  return out;
}

/** Canonical Sprite for body.media.sprite. */
export function spriteToCanonical(v: SpritePartsValue): Record<string, unknown> {
  const out: Record<string, unknown> = { parts: { ...v.parts } };
  if (v.gender) out.gender = v.gender;
  if (v.eyeColor) out.eyeColor = v.eyeColor;
  if (v.bodyColor) out.bodyColor = v.bodyColor;
  if (v.hairColor) out.hairColor = v.hairColor;
  return out;
}
