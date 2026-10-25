/**
 * Next send, the Prompt Inspector's second sub-tab (RoleCall `PromptPreviewPanel.tsx`): the request a send of what is in the composer would build, as a forecast. The line "N messages | ~T tokens",
 * "Updating..." while a newer one is built, Copy, a search over role and text, one block per message with its role (system, user, assistant) and the assembler's own count, and RoleCall's footer.
 * Empty, error and no-match states are RoleCall's words. A forecast that leaves something out (the Compendium's recall, prompt regex) says so under the blocks.
 */
import { useState, type JSX } from "react";
import { Ic } from "../../../_shared/ic";
import { copyText } from "../../../_shared/clipboard";
import { FLASH_MS, useFlash } from "../../../_shared/use-flash";
import { copyFormat, filterMessages, highlightParts, statusLine } from "./next-send-core";
import type { ForecastState } from "./use-forecast";

export function NextSend({ state }: { state: ForecastState }): JSX.Element {
  const [query, setQuery] = useState("");
  const copied = useFlash<boolean>(FLASH_MS.copy);
  const { forecast, loading, error } = state;
  const shown = forecast ? filterMessages(forecast.messages, query) : [];
  const copy = (): void => {
    if (!forecast) return;
    void copyText(copyFormat(forecast.messages)).then((ok) => { if (ok) copied.flash(true); });
  };
  return (
    <div className="ns" data-part="scene.context.next-send">
      <div className="ns-hd">
        <p>{statusLine(forecast ? { count: forecast.messages.length, tokens: forecast.tokens } : null, loading)}</p>
        <div>
          {loading && forecast && <span className="ns-upd"><Ic name="lucide:loader-circle" size={14} />Updating...</span>}
          <button type="button" className="ns-copy" disabled={!forecast} onClick={copy}><Ic name={copied.value ? "lucide:check" : "lucide:copy"} size={14} />{copied.value ? "Copied!" : "Copy"}</button>
        </div>
      </div>
      <div className="ns-search">
        <Ic name="lucide:search" size={14} />
        <input type="text" aria-label="Search role or content" placeholder="Search role or content..." value={query} onChange={(e) => setQuery(e.target.value)} />
        {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><Ic name="lucide:x" size={14} /></button>}
        {forecast && query.trim() && <small>Showing {shown.length} of {forecast.messages.length} messages</small>}
      </div>
      <div className="ns-body">
        {error ? (
          <div className="ns-empty err" role="alert"><Ic name="lucide:circle-alert" size={40} /><p>Preview Error</p><small>{error}</small></div>
        ) : !forecast && !loading ? (
          <div className="ns-empty"><Ic name="lucide:eye" size={40} /><p>Type a message to see the preview</p><small>Preview updates in real-time as you type</small></div>
        ) : forecast && shown.length === 0 ? (
          <div className="ns-empty"><Ic name="lucide:search" size={32} /><p>No matches found</p><small>Try a different search term</small></div>
        ) : (
          shown.map((m, i) => (
            <div className={`ns-msg ${m.role}`} key={i}>
              <div><i />{m.role}<span>~{m.tokens.toLocaleString()} tokens</span></div>
              <pre>{highlightParts(m.content, query).map((p, j) => (p.hit ? <mark key={j}>{p.text}</mark> : <span key={j}>{p.text}</span>))}</pre>
            </div>
          ))
        )}
      </div>
      {forecast && (
        <div className="ns-foot">
          <p><i />This is an assembly forecast and may change before dispatch. This turn records what was actually sent.</p>
          {forecast.notes.map((n) => <p key={n}>{n}</p>)}
        </div>
      )}
    </div>
  );
}
