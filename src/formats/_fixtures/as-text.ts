/** Build adapter input from a JSON-shaped value for public codec tests. */
export const asText = (value: unknown, filename?: string) => ({
  text: JSON.stringify(value),
  ...(filename ? { filename } : {}),
});
