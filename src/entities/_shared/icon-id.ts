/**
 * The decoder's check for an icon id a piece carries (a tracker's, a tracker field's): well formed, in the shape the glyph generator reads (scripts/ic-glyphs.ts),
 * a set name, a colon and a lowercase name. It is NOT checked against the glyph table: entities do not import the UI's table, and a piece may name a glyph a
 * newer or older build ships. Drawing only the ids the build knows (and nothing for the rest) is the UI's job.
 */
import { z } from "zod";
import { SANITY_TEXT } from "./sanity";

/** The icon sets the app ships glyphs from, and the id shape the generator matches. */
export const ICON_ID = /^(lucide|mdi):[a-z0-9-]+$/;

/** The decoder's schema for an icon id; absent is `.optional()` at the use site. */
export const iconIdSchema = z.string().max(SANITY_TEXT).regex(ICON_ID);
