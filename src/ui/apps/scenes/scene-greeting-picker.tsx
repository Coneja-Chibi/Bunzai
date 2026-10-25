/** The Opening Message header before the first send (RoleCall's greeting picker): which of the card's greetings starts the scene. */
import type { JSX } from "react";
import { Ic } from "../../_shared/ic";

export function GreetingPicker({ count, index, onPick }: { count: number; index: number; onPick(i: number): void }): JSX.Element {
  return (
    <div className="greet">
      <div className="hd"><Ic name="lucide:message-square" />Opening Message <small>({index + 1} of {count})</small></div>
      {count > 1 && (
        <div className="dots">{Array.from({ length: count }, (_, i) => <button type="button" key={i} className={i === index ? "on" : undefined} aria-label={`Greeting ${i + 1}`} onClick={() => onPick(i)} />)}</div>
      )}
      <p className="help">This will be the first message in your conversation</p>
    </div>
  );
}
