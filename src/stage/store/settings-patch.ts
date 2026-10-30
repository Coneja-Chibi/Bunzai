/** Apply checked settings fields: null removes a key, undefined retains it, and supplied values replace it. */
export function applySettingsPatch(old: object | undefined, patch: object): Record<string, unknown> {
  const next: Record<string, unknown> = { ...old };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete next[key];
    else if (value !== undefined) next[key] = value;
  }
  return next;
}
