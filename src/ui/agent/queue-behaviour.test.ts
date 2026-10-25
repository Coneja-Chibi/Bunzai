/**
 * What happens to a message typed while the agent is still answering.
 *
 * The bound and the FIFO are Kit's, tested where they live (kit/render/primitives/composer/queue.test.ts).
 * What is pinned here is what this window does with the queue across a reload and a reset.
 */
import { describe, expect, test } from "bun:test";
import { QUEUE_KEY, RESET_KEYS } from "../_shared/window-memory";

describe("what the queue survives", () => {
  test("A RELOAD DOES NOT EAT IT", () => {
    /**
     * Session storage rather than component state, because this page reloads itself whenever the
     * source changes underneath it - and a queued message is something somebody wrote and has not
     * seen answered yet.
     */
    expect(RESET_KEYS.some((k) => k.key === QUEUE_KEY && k.where === "session")).toBe(true);
  });

  test("BUT A RESET CLEARS IT, with the transcript it belongs to", () => {
    // A fresh conversation inheriting the last one's unsent thoughts would send them into a chat
    // they were never meant for.
    expect(RESET_KEYS.map((k) => k.key)).toContain(QUEUE_KEY);
  });
});
