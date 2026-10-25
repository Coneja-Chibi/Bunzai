/**
 * [emotion:X] trigger matching. Ported from RoleCall's triggers/emotion.ts matchEmotionTrigger,
 * pure and unchanged: anti-patterns veto, then regex patterns, then phrases,
 * then keywords, each checked with word boundaries. Data lives in triggers-emotion-banks-1.ts and
 * triggers-emotion-banks-2.ts.
 */
import { escapeRegex } from "../../regex/escape";
import { EMOTION_BANKS_1, type EmotionPattern } from "./triggers-emotion-banks-1";
import { EMOTION_BANKS_2 } from "./triggers-emotion-banks-2";

const EMOTION_PATTERNS: Record<string, EmotionPattern> = { ...EMOTION_BANKS_1, ...EMOTION_BANKS_2 };

function wordBoundaryRegex(term: string): RegExp {
  return new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
}

export function matchEmotionTrigger(emotionType: string, text: string): boolean {
  const pattern = EMOTION_PATTERNS[emotionType.toLowerCase()];
  if (!pattern) return false;

  for (const antiPattern of pattern.antiPatterns) {
    if (antiPattern.test(text)) return false;
  }
  for (const regex of pattern.patterns) {
    if (regex.test(text)) return true;
  }
  for (const phrase of pattern.phrases) {
    if (wordBoundaryRegex(phrase).test(text)) return true;
  }
  for (const keyword of pattern.keywords) {
    if (wordBoundaryRegex(keyword).test(text)) return true;
  }
  return false;
}

export function isValidEmotion(emotionType: string): boolean {
  return emotionType.toLowerCase() in EMOTION_PATTERNS;
}
