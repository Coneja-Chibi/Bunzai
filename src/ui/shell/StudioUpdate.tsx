/** One explicit reload action for pending source updates and server restarts, shared by top bar and overlay. */
import { Button } from "../components/button";
import { useShellStore } from "./store";
import styles from "./studio-update.module.css";

export function StudioUpdate({ compact = false }: { compact?: boolean }) {
  const update = useShellStore((state) => state.devUpdate);
  if (!update) return null;
  const message = update === "restart" ? "Studio restarted. Reload to reconnect." : "Update ready. Reload when you're ready.";
  if (compact) return <><span role="status" className={styles.announcement}>{message}</span><Button size="sm" title={message} onClick={() => window.location.reload()}>Reload Studio</Button></>;
  return <div className={styles.notice}>
    <span role="status">{message}</span>
    <Button size="sm" onClick={() => window.location.reload()}>Reload Studio</Button>
  </div>;
}
