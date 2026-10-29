/**
 * LeavingGate - the full-window "you are leaving Bunzai" interstitial. Mounted once at the shell so it
 * covers the dock, tabs, and footer (a hard stop, not a modal). It listens to the link-gate bus: when a
 * rendered external link is clicked, it takes over the window, shows the REAL destination host + url
 * (and warns when the link's visible text named a different host), and only on Continue hands the url
 * to POST /api/open, which re-validates and opens the OS browser. Go back or Escape dismisses.
 *
 * This is the UX half. The route is the enforcement half; this page cannot open anything the route
 * would refuse, so a styling or logic slip here degrades to "nothing opens", never "unsafe open".
 */
import { Button } from "../button";
import { useEffect, useState } from "react";
import type { JSX } from "react";
import type { ExternalLink } from "../../_shared/external-url";
import { apiFetch } from "../../_shared/api-fetch";
import { subscribeExternal } from "../../_shared/link-gate";
import { platformFor, platformMark } from "../../_shared/platform-registry";
import { readableInk } from "../../_shared/color-math";
import { DialogCore } from "../dialog-core";
import styles from "./styles.module.css";
import { Ic } from "../../_shared/ic";

/** Globe mark for an unrecognized host - a neutral badge, never a fetched favicon. */
const GlobeMark = <Ic name="lucide:globe" size={20} />;

export function LeavingGate(): JSX.Element | null {
  const [target, setTarget] = useState<ExternalLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const dismiss = (): void => {
    setTarget(null);
    setBusy(false);
    setFailed(false);
  };

  useEffect(
    () =>
      subscribeExternal((t) => {
        setTarget(t);
        setBusy(false);
        setFailed(false);
      }),
    [],
  );

  if (target === null) return null;

  // recognize the host from the LOCAL registry only - a badge never fetches anything from the site
  const platform = platformFor(target.host);

  const proceed = async (): Promise<void> => {
    setBusy(true);
    setFailed(false);
    try {
      const res = await apiFetch("/api/open", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: target.url }),
      });
      if (!res.ok) throw new Error(String(res.status));
      dismiss();
    } catch {
      setBusy(false);
      setFailed(true);
    }
  };

  return (
    <DialogCore
      placement="center"
      ariaLabel="Leaving Bunzai"
      onDismiss={dismiss}
      overlayClassName={styles.scrim}
      className={styles.card}
      dismissOnScrim={false}
    >
        <div className={styles.kicker}>You are leaving Bunzai</div>
        <p className={styles.lede}>This link opens in your web browser. Bunzai does not vouch for where it goes.</p>
        <div className={styles.badge}>
          {platform ? (
            <span className={styles.tile} style={{ background: platform.color, color: readableInk(platform.color) }}>
              {platformMark(platform)}
            </span>
          ) : (
            <span className={`${styles.tile} ${styles.globe}`}>{GlobeMark}</span>
          )}
          <span className={styles.pname}>{platform ? platform.name : target.host}</span>
        </div>
        <div className={styles.url}>{target.url}</div>
        {target.mismatch && (
          <div className={styles.warn}>
            The link text names a different site than where it actually points. Only continue if you trust it.
          </div>
        )}
        {failed && (
          <div className={styles.warn}>Could not open the link. Copy the address above into your browser.</div>
        )}
        <div className={styles.row}>
          <Button onClick={dismiss} disabled={busy}>
            Go back
          </Button>
          <Button variant="primary" onClick={() => void proceed()} disabled={busy}>
            {busy ? "Opening..." : "Continue"}
          </Button>
        </div>
    </DialogCore>
  );
}
