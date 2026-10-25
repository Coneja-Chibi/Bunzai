/** Render an error's message, a caller fallback, or the value's string form in that order. */
export function toErrorMessage(error: unknown, fallback?: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback ?? String(error);
}
