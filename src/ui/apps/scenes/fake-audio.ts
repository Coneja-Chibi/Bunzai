/** A stand-in for HTMLAudioElement for the Mood Music tests (stage-music-player.test.ts, stage-music.test.tsx): records every call, fires play and pause like the real one, and can refuse a play. Tests import it. */
import type { AudioLike } from "./stage-music-player";

export class FakeAudio implements AudioLike {
  src = ""; loop = false; volume = 1; preload = "auto";
  log: string[] = [];
  refuse: Error | null = null;
  private handlers = new Map<string, Set<() => void>>();
  async play(): Promise<void> { this.log.push("play"); if (this.refuse) throw this.refuse; this.fire("play"); }
  pause(): void { this.log.push("pause"); this.fire("pause"); }
  load(): void { this.log.push("load"); }
  removeAttribute(name: string): void { this.log.push(`remove ${name}`); if (name === "src") this.src = ""; }
  addEventListener(type: "play" | "pause", fn: () => void): void { (this.handlers.get(type) ?? this.handlers.set(type, new Set()).get(type)!).add(fn); }
  removeEventListener(type: "play" | "pause", fn: () => void): void { this.handlers.get(type)?.delete(fn); }
  fire(type: string): void { this.handlers.get(type)?.forEach((f) => f()); }
  listeners(): number { return [...this.handlers.values()].reduce((n, s) => n + s.size, 0); }
}
