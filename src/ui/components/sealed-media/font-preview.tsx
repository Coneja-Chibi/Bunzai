/** Renders a bounded FontFace preview from the shared decrypted asset cache. */
import { useEffect, useState, type JSX } from "react";
import { useAsset } from "../../_shared/art-cache";
import { loadUserFont } from "../../_shared/user-fonts";
import styles from "./styles.module.css";

export function FontPreview({ sha, name }: { sha: string; name: string }): JSX.Element {
  const family = `Bunraku-${sha}`;
  const [ready, setReady] = useState(false);
  const asset = useAsset({ sha });
  useEffect(() => {
    let live = true;
    setReady(false);
    if (asset.src) void loadUserFont(sha, family).then(() => { if (live) setReady(true); }).catch(() => { if (live) setReady(false); });
    return () => { live = false; };
  }, [asset.src, family, sha]);
  return <div ref={asset.ref} className={styles.font} style={ready ? { fontFamily: `'${family}'` } : undefined}>{ready ? `${name} · Aa 123` : asset.failed ? "Font preview unavailable" : "Font"}</div>;
}
