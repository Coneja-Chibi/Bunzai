/** Canonical media slots shared by part encoding and light-read projection. */
export function isCanonicalMediaReference(kind: string, path: readonly (string | number)[]): boolean {
  const p = path.map(String);
  if (p.length === 4 && p[0] === "original" && p[2] === "sourceMedia" && p[3] === "b64") return true;
  if (kind === "character") {
    return (p.length === 4 && p[0] === "body" && p[1] === "media" && p[2] === "portrait" && p[3] === "ref") ||
      (p.length === 5 && p[0] === "body" && p[1] === "media" && p[2] === "assets" && /^\d+$/.test(p[3]!) && p[4] === "ref") ||
      (p.length === 4 && p[0] === "body" && p[1] === "presentation" && p[2] === "background" && p[3] === "ref") ||
      (p.length === 7 && p[0] === "body" && p[1] === "variants" && /^\d+$/.test(p[2]!) && p[3] === "overrides" && p[4] === "media" && p[5] === "portrait" && p[6] === "ref") ||
      (p.length === 8 && p[0] === "body" && p[1] === "variants" && /^\d+$/.test(p[2]!) && p[3] === "overrides" && p[4] === "media" && p[5] === "assets" && /^\d+$/.test(p[6]!) && p[7] === "ref") ||
      (p.length === 7 && p[0] === "body" && p[1] === "variants" && /^\d+$/.test(p[2]!) && p[3] === "overrides" && p[4] === "presentation" && p[5] === "background" && p[6] === "ref");
  }
  if (kind === "persona") return (p.length === 4 && p[0] === "body" && p[1] === "media" && p[2] === "portrait" && p[3] === "ref") ||
    (p.length === 3 && p[0] === "body" && p[1] === "presentation" && p[2] === "imageUrl");
  if (kind === "pack") {
    return (p.length === 5 && p[0] === "body" && p[1] === "pack" && p[2] === "items" && /^\d+$/.test(p[3]!) && p[4] === "ref") ||
      (p.length === 6 && p[0] === "body" && p[1] === "groups" && p[3] === "items" && /^\d+$/.test(p[4]!) && p[5] === "ref");
  }
  return false;
}
