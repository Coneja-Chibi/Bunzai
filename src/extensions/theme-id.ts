/** The bounded imported theme package ID accepted at package and saved-setting boundaries. */
export const isThemePackageId = (value: unknown): value is string =>
  typeof value === "string" && /^bunzai\.theme\.[a-z0-9][a-z0-9.-]{1,58}$/.test(value);
