/** Desktop listen-port selection and claim policy. */
import { runningBunrakuAt } from "./ui/port-owner";

export const DEFAULT_DESKTOP_PORT = 8321;
const DEFAULT_PORT_TRIES = 10;

/** Parse the opt-in desktop port before any library or server startup effects. */
export function desktopPortOverride(value: string | undefined): number | null {
  if (value === undefined) return null;
  if (!/^[0-9]{1,5}$/.test(value)) throw new Error("BUNRAKU_PORT must be a decimal port from 1024 to 65535");
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("BUNRAKU_PORT must be a decimal port from 1024 to 65535");
  }
  return port;
}

/** An override is an exact, isolated claim; only the default mode may reuse another Bunraku. */
export async function claimDesktopPort<T extends { url: string; stop: () => void }>(
  override: number | null,
  start: (port: number) => T,
  isBunrakuRunning: (port: number) => Promise<string | null> = runningBunrakuAt,
): Promise<{ server: T; ours: boolean }> {
  if (override !== null) {
    if (await isBunrakuRunning(override)) throw new Error(`Bunraku is already running on requested port ${override}`);
    const server = start(override);
    if (server.url !== `http://127.0.0.1:${override}`) {
      server.stop();
      throw new Error(`desktop server did not claim requested port ${override}`);
    }
    return { server, ours: true };
  }

  for (let port = DEFAULT_DESKTOP_PORT; port < DEFAULT_DESKTOP_PORT + DEFAULT_PORT_TRIES; port += 1) {
    try {
      return { server: start(port), ours: true };
    } catch {
      const existing = await isBunrakuRunning(port);
      if (existing) return { server: { url: existing, stop: () => {} } as T, ours: false };
    }
  }
  throw new Error(`no free port between ${DEFAULT_DESKTOP_PORT} and ${DEFAULT_DESKTOP_PORT + DEFAULT_PORT_TRIES - 1}`);
}
