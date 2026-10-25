/** One avatar element per initial for the person's own bubbles, so a finished bubble keeps its art identity while the page re-renders. */
import { useRef, type JSX } from "react";

export function useUserArt(): (initial: string) => JSX.Element {
  const arts = useRef(new Map<string, JSX.Element>());
  return (initial) => {
    let art = arts.current.get(initial);
    if (!art) arts.current.set(initial, (art = <div className="por"><span className="ini">{initial}</span></div>));
    return art;
  };
}
