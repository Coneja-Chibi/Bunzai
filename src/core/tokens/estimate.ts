/** The one rough token estimate for authoring gauges ("~tokens"): four characters to a token, rounded up. Never a billing or model-accurate count (that is countText). */
export function roughTokenCount(text: string | number): number {
  const chars = typeof text === "number" ? text : text.length;
  return chars > 0 ? Math.ceil(chars / 4) : 0;
}
