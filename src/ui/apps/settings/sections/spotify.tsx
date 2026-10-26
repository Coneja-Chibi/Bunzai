/**
 * Settings > Spotify: RoleCall keeps the connect step in Settings too (SpotifySection.tsx: paste your own Spotify app's Client ID, then
 * sign in). Bunraku has no server of its own, so the sign-in comes back to this app on the loopback address (`http://127.0.0.1:<port>`),
 * the one kind of http redirect Spotify allows. There is no shared key and no client secret: the Client ID is the person's own, and the
 * refresh token it earns is kept only in this computer's key vault, never in a preference, a log, an export or what a model sees.
 * The Stage wing's Spotify tab and mini player come from the Spotify Prop (the Props wing), which is how it is turned off and on again.
 * Controlling playback needs Spotify Premium; the row says so rather than letting a button fail.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import type { AppContext } from "../../../app-contract";
import { toErrorMessage } from "../../../_shared/error-message";
import { protect } from "../../../_shared/protected-control";
import { Button } from "../../../components/button";
import { SettingsRow, type SettingsSection } from "../section-contract";
import styles from "./connections.module.css";

interface Status { clientId: string | null; connected: boolean; premium: boolean | null; name: string | null; redirectUri: string; registerUri: string }
const WAIT_MS = 2000;
const WAIT_TRIES = 90;

function SpotifySection({ ctx }: { ctx: AppContext }): JSX.Element {
  const send = ctx.api.spotifyPost;
  const [status, setStatus] = useState<Status | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (): Promise<Status | null> => {
    try {
      const s = await ctx.api.spotifyGet<Status>("/api/spotify/status");
      setStatus(s);
      setDraft((d) => d || s.clientId || "");
      return s;
    } catch (e) {
      setProblem(toErrorMessage(e, "could not read the Spotify link"));
      return null;
    }
  }, [ctx]);
  const stopWaiting = useCallback((): void => { if (timer.current) clearInterval(timer.current); timer.current = null; setWaiting(false); }, []);
  useEffect(() => { void load(); return stopWaiting; }, [load, stopWaiting]);

  const run = async (work: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setProblem(null);
    try { await work(); } catch (e) { setProblem(toErrorMessage(e, "that did not work")); } finally { setBusy(false); }
  };

  const connect = (): Promise<void> => run(async () => {
    if (draft.trim() !== (status?.clientId ?? "")) await send("/api/spotify/client", { clientId: draft.trim() });
    await send("/api/spotify/connect", {});
    setWaiting(true);
    let tries = 0;
    // interval-ok: waits for the sign-in that happens in Spotify's own window (this tab is usually hidden then); capped at WAIT_TRIES.
    timer.current = setInterval(() => { // interval-ok: see the line above
      tries += 1;
      void load().then((s) => { if (s?.connected || tries >= WAIT_TRIES) stopWaiting(); });
    }, WAIT_MS);
  });

  const connected = status?.connected === true;
  return (
    <div {...protect("spotify-link")}>
      <SettingsRow
        label="Spotify"
        hint="Control the Spotify app you already have open from the Stage wing: play, pause, skip, volume, and which device it plays on. Playback control needs Spotify Premium. Turn it on for a scene in the Props wing."
      >
        <span className={connected ? styles.good : styles.state}>
          {connected ? `Connected${status?.name ? ` as ${status.name}` : ""}${status?.premium === false ? ", without Premium" : ""}` : waiting ? "Waiting for Spotify..." : "Not connected"}
        </span>
      </SettingsRow>

      <SettingsRow
        label="Client ID"
        hint="Make an app at developer.spotify.com/dashboard and paste its Client ID (32 letters and digits). It is yours alone; Bunraku has no shared key. The sign-in is kept in this computer's key vault."
      >
        <input
          className={styles.snippet}
          value={draft}
          spellCheck={false}
          placeholder="0123456789abcdef0123456789abcdef"
          aria-label="Spotify Client ID"
          onChange={(e) => setDraft(e.target.value)}
        />
      </SettingsRow>

      <SettingsRow
        label="Redirect address"
        hint="Add this to your Spotify app's Redirect URIs, exactly. Spotify allows a plain http address only for 127.0.0.1, and lets that address use any port, so it still works when Bunraku starts on another one."
      >
        <code className={styles.snippet}>{status?.registerUri ?? "http://127.0.0.1/spotify/callback"}</code>
      </SettingsRow>

      <SettingsRow
        label="Account"
        hint={connected
          ? "Disconnect forgets the sign-in on this computer. To take the app's access away at Spotify too, remove it at spotify.com/account/apps."
          : "Connect opens Spotify's sign-in in your browser. Bunraku sees only the playback state and the controls, never your password."}
      >
        {connected
          ? <div className={styles.add}><Button variant="danger" disabled={busy} onClick={() => { void run(async () => { await send("/api/spotify/disconnect", {}); await load(); }); }}>Disconnect</Button></div>
          : <div className={styles.add}><Button variant="primary" disabled={busy || waiting || !draft.trim()} onClick={() => { void connect(); }}>Connect</Button></div>}
      </SettingsRow>

      {waiting && <p className={styles.state}>A browser window opened to sign in to Spotify. Come back here when you are done.</p>}
      {problem !== null && <p className={styles.problem}>{problem}</p>}
    </div>
  );
}

const section: SettingsSection = {
  id: "spotify",
  act: "agent",
  title: "Spotify",
  lede: "Control the Spotify app you already have open from the Stage wing: play, pause, skip, volume, and which device it plays on. Playback control needs Spotify Premium. Turn it on for a scene in the Props wing.",
  protectedNote: "There is no shared key and no client secret. The sign-in is kept only in this computer's key vault, never in a preference, a log, an export or what a model sees.",
  label: "Spotify",
  // Beside Connections: both are accounts and tools this machine reaches.
  order: 17,
  Component: SpotifySection,
};

export default section;
