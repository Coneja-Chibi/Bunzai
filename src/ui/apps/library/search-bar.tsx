/**
 * The Library's search chrome: the box that sits in the deck bar, and the notice that stands on the
 * shelf when a search matched nothing here.
 *
 * Both are renderers. Every decision about what matches, what ranks, and what the count line says
 * lives in search-core.ts, so this file holds no meaning worth testing without a browser.
 *
 * THE NOTICE IS THE POINT OF THE WHOLE FILE. Before it, a shelf filtered down to nothing rendered
 * the ghost card that says "your first character lands here" - the same picture as a deck nobody
 * has ever put anything in. That is a room telling somebody their work is gone. The notice says
 * the opposite in words, keeps the count of what is still here, and points at the deck that does
 * hold a match.
 */
import type { JSX } from "react";
import { deckMeta } from "../../_shared/decks";
import { isEscapeClose } from "../../_shared/use-escape-key";
import { Button, Chip } from "../../components/button";

export interface SearchBoxProps {
  value: string;
  onChange: (next: string) => void;
  /** the parser's own words about anything it did not understand (search-core's unknownHint) */
  hint: string;
  status?: string;
  onRetry?: () => void;
}

export function SearchBox({ value, onChange, hint, status, onRetry }: SearchBoxProps): JSX.Element {
  return (
    <div className={`findwrap${value ? " on" : ""}`}>
      <label className="findbox">
        <span className="sk">find</span>
        <input
          type="text"
          value={value}
          spellCheck={false}
          autoComplete="off"
          placeholder="name, kind:preset, from:sillytavern, has:art"
          aria-label="Search the library"
          title={'Search names, ids, lorebook keywords and tags. Fields: name: id: kind: from: has:. Quote "a phrase", prefix - to exclude.'}
          onChange={(ev) => onChange(ev.target.value)}
          // Escape clears from inside the box, because reaching for the mouse to empty a text
          // field is the one thing every other search box in the world has trained against.
          onKeyDown={(ev) => {
            if (isEscapeClose(ev) && value) {
              ev.stopPropagation();
              onChange("");
            }
          }}
        />
        {value && (
          <Button size="sm" variant="quiet" title="Clear search"
            aria-label="Clear search"
            onClick={() => onChange("")}>
            Clear
          </Button>
        )}
      </label>
      {hint && <p className="findnote">{hint}</p>}
      {status && <p className="findnote" role="status">{status}{onRetry && <> <Button size="sm" variant="quiet" onClick={onRetry}>Retry</Button></>}</p>}
    </div>
  );
}

export interface NoMatchNoticeProps {
  /** what was typed, echoed back verbatim so there is no doubt what was searched */
  query: string;
  /** the shelf being looked at ("Presets") */
  deckPlural: string;
  /** how many pieces this deck holds in total, matching or not */
  deckTotal: number;
  /** matches sitting in other decks, biggest first */
  elsewhere: readonly { kind: string; count: number }[];
  onJump: (kind: string) => void;
  onClear: () => void;
}

export function NoMatchNotice({
  query,
  deckPlural,
  deckTotal,
  elsewhere,
  onJump,
  onClear,
}: NoMatchNoticeProps): JSX.Element {
  const plural = deckPlural.toLowerCase();
  return (
    <div className="nomatch">
      <strong className="nmhead">{`No ${plural} match`}</strong>
      <p className="nmbody">
        {"Nothing on this shelf matches "}
        <code className="nmq">{query}</code>
        {/* The count is here on purpose: it is the sentence that separates "filtered" from "empty". */}
        {`. All ${String(deckTotal)} ${plural} are still in the studio; this shelf is filtered, not bare.`}
      </p>
      {elsewhere.length > 0 && (
        <div className="nmjumps">
          <span className="nmk">also matching</span>
          {elsewhere.map(/* bounded-ok: fixed app / doc / deck-kind / store sets, or short per-import summaries */ ({ kind, count }) => (
            <Chip key={kind} onClick={() => onJump(kind)}>
              {`${deckMeta(kind).plural} ${String(count)}`}
            </Chip>
          ))}
        </div>
      )}
      <Button size="sm" variant="quiet" onClick={onClear}>
        Clear search
      </Button>
    </div>
  );
}
