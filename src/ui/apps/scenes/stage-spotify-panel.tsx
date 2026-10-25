/**
 * The Stage wing's Spotify tab: RoleCall's SpotifyWingPanel (SpotifyWingPanel.tsx:169-497), controlling the Spotify app the person already has
 * open, through the local server. Top to bottom as RoleCall draws it: now playing (160px art, track, artists, click-to-seek bar with the
 * clock), Previous, Play or Pause and Next, the device volume when the device has one, then a "Devices (n)" section to pick where it plays.
 * The Chat Integration section (Mood, Tools, Hybrid) is not here: those modes need the Story Director to drive music, which it does not yet. Playback
 * control needs Spotify Premium, and a person without it is told so rather than shown buttons that fail.
 */
import { useState, type JSX } from "react";
import { Ic } from "../../_shared/ic";
import { Slider } from "../../components/slider";
import { deviceGlyph, formatMs, progressPct, safeArt, seekTo } from "./stage-spotify-core";
import type { SpotifyFeed } from "./stage-spotify-feed";
import { useStageSpotify } from "./use-stage-spotify";

function Section({ label, open, onToggle }: { label: string; open: boolean; onToggle(): void }): JSX.Element {
  return (
    <button type="button" className="sp-sec" aria-expanded={open} onClick={onToggle}>
      <span>{label}</span><span className={`sp-chev${open ? " open" : ""}`}><Ic name="lucide:chevron-down" size={16} /></span>
    </button>
  );
}

export function SpotifyPanel({ feed }: { feed: SpotifyFeed }): JSX.Element {
  const { state } = useStageSpotify(feed, { devices: true });
  const [devicesOpen, setDevicesOpen] = useState(false);

  if (state.phase === "off") {
    return (
      <div className="spot">
        <div className="sp-empty">
          <div className="sp-disc"><Ic name="lucide:music" size={32} /></div>
          <p>Spotify is not connected</p>
          <p className="sp-fine">Connect it in Settings, under Spotify.</p>
          {state.message && <p className="sp-err">{state.message}</p>}
        </div>
      </div>
    );
  }
  const { playback, devices, status } = state;
  const track = playback?.track ?? null;
  const art = safeArt(track?.art);
  const durationMs = track?.durationMs ?? 0;
  const volume = playback?.device?.volume ?? null;
  return (
    <div className="spot" data-part="scene.stage.spotify">
      <div className="sp-info">
        <span className={`sp-dot${playback?.playing ? " live" : ""}`} aria-hidden="true" />
        <span>{status?.name ?? "Spotify"}</span>
        {status?.premium === true && <span className="sp-pill">Premium</span>}
      </div>
      {status?.premium === false && <p className="sp-note">Spotify needs Premium to control playback. You can still see what is playing.</p>}
      {state.message && <p className="sp-err">{state.message}</p>}

      <div className="sp-body">
        {track ? (
          <>
            <div className="sp-now">
              {art ? <img className="sp-art" src={art} alt="Album art" /> : <div className="sp-art none"><Ic name="lucide:music" size={64} /></div>}
              <div className="sp-names"><p className="sp-track">{track.name}</p><p className="sp-artists">{track.artists.join(", ")}</p></div>
              <div className="sp-prog">
                <div className="sp-bar" role="slider" aria-label="Seek" aria-valuemin={0} aria-valuemax={durationMs} aria-valuenow={playback?.progressMs ?? 0}
                  onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); void feed.act({ action: "seek", value: seekTo(e.clientX, r.left, r.width, durationMs) }); }}>
                  <div className="sp-fill" style={{ width: `${String(progressPct(playback?.progressMs ?? 0, durationMs))}%` }} />
                </div>
                <div className="sp-clock"><span>{formatMs(playback?.progressMs ?? 0)}</span><span>{formatMs(durationMs)}</span></div>
              </div>
            </div>
            <div className="sp-controls">
              <div className="sp-btns">
                <button type="button" className="sp-sq" onClick={() => void feed.act({ action: "previous" })} aria-label="Previous"><Ic name="lucide:skip-back" size={20} /></button>
                <button type="button" className="sp-play" onClick={() => void feed.toggle()} aria-label={playback?.playing ? "Pause" : "Play"}><Ic name={playback?.playing ? "lucide:pause" : "lucide:play"} size={24} /></button>
                <button type="button" className="sp-sq" onClick={() => void feed.act({ action: "next" })} aria-label="Next"><Ic name="lucide:skip-forward" size={20} /></button>
              </div>
              {volume !== null && (
                <div className="sp-vol"><Ic name="lucide:volume-2" size={16} />
                  <Slider value={volume} min={0} max={100} step={1} onChange={(v) => void feed.act({ action: "volume", value: v })} format={(v) => `${String(v)}%`} aria-label="Volume" />
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="sp-empty">
            <div className="sp-disc"><Ic name="lucide:music" size={32} /></div>
            <p>No active playback</p>
            <p className="sp-fine">Play something to see controls here</p>
          </div>
        )}

        <Section label={`Devices${devices.length > 0 ? ` (${String(devices.length)})` : ""}`} open={devicesOpen} onToggle={() => setDevicesOpen((v) => !v)} />
        {devicesOpen && (
          <div className="sp-devices">
            <div className="sp-refresh"><button type="button" onClick={() => void feed.refreshDevices()}><Ic name="lucide:refresh-cw" size={14} />Refresh</button></div>
            {devices.length === 0
              ? <p className="sp-none">No devices found. Open Spotify on any device.</p>
              : devices.map((d) => (
                <button type="button" key={d.id} className={`sp-device${d.active ? " on" : ""}`} onClick={() => void feed.act({ action: "transfer", deviceId: d.id })}>
                  <Ic name={deviceGlyph(d.type)} size={16} />
                  <span className="sp-dname"><b>{d.name}</b><small>{d.type.toLowerCase()}</small></span>
                  {d.active && <Ic name="lucide:check" size={14} />}
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
