/**
 * Max tool rounds (RoleCall's Control Booth "Max tool rounds", QuickPlayPanel.tsx:2128-2149; clamped 1 to 20 in
 * lib/scene/stage-settings-persistence.ts:183-184, default 8): how many rounds of tool calls the narrator gets in one reply.
 * One set for the store's check, the Booth's control and the turn.
 */
export const TOOL_ROUNDS_MIN = 1;
export const TOOL_ROUNDS_MAX = 20;
export const TOOL_ROUNDS_DEFAULT = 8;
