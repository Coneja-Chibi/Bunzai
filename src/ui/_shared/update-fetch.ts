/** Common timeout and headers for the two fixed-host GitHub release requests. */
export function fetchUpdateApi(url: string, extraHeaders: Record<string, string> = {}): Promise<Response> {
  return fetch(url, {
    signal: AbortSignal.timeout(6000),
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "bunraku-update-check",
      ...extraHeaders,
    },
  });
}
