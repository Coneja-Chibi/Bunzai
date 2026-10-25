/** Release evidence rows for the scale design Missing rows fail closed. */
import { STUDIO_ENTITY_KINDS } from "../../src/studio/path-policy";

export interface BudgetRow {
  id: string;
  unit: string;
  minimum?: number;
  maximum?: number;
  minimumSamples?: number;
}

export const PROFILE = "low-end" as const;
export const BUDGETS: readonly BudgetRow[] = [
  { id: "library.ready_ms", unit: "ms", maximum: 600 },
  { id: "complexity.summary_list_1k_ms", unit: "ms", minimumSamples: 1 },
  { id: "complexity.summary_list_10k_ms", unit: "ms", minimumSamples: 10_000 },
  { id: "complexity.summary_list_10x_time_ratio", unit: "ratio", minimumSamples: 2 },
  { id: "complexity.search.matches_1k", unit: "pieces", minimum: 1_000, maximum: 1_000, minimumSamples: 1 },
  { id: "complexity.search.matches_10k", unit: "pieces", minimum: 10_000, maximum: 10_000, minimumSamples: 1 },
  { id: "complexity.search.query_1k_ms", unit: "ms", minimumSamples: 1 },
  { id: "complexity.search.query_10k_ms", unit: "ms", minimumSamples: 1 },
  { id: "complexity.search.query_ratio_10x", unit: "ratio", minimumSamples: 2 },
  { id: "complexity.chat.read_400_ms", unit: "ms", minimumSamples: 1 },
  { id: "complexity.chat.read_4000_ms", unit: "ms", minimumSamples: 1 },
  { id: "complexity.chat.read_ratio_10x", unit: "ratio", minimumSamples: 2 },
  ...STUDIO_ENTITY_KINDS.flatMap((kind) => [
    { id: `complexity.editor.${kind}.save_click_ms_1k`, unit: "ms", minimumSamples: 1 },
    { id: `complexity.editor.${kind}.save_click_ms_10k`, unit: "ms", minimumSamples: 1 },
    { id: `complexity.editor.${kind}.save_click_ratio_10x`, unit: "ratio", minimumSamples: 2 },
  ]),
  { id: "complexity.preset_save_growth_n_300", unit: "bytes", minimumSamples: 1 },
  { id: "complexity.preset_save_growth_n_3000", unit: "bytes", minimumSamples: 1 },
  { id: "complexity.preset_save_growth_ratio_10x", unit: "ratio", minimumSamples: 2 },
  { id: "complexity.assets.upload_count_1x", unit: "assets", minimum: 106, maximum: 106, minimumSamples: 106 },
  { id: "complexity.assets.upload_count_10x", unit: "assets", minimum: 1_060, maximum: 1_060, minimumSamples: 1_060 },
  { id: "complexity.assets.upload_time_1x_ms", unit: "ms", minimumSamples: 106 },
  { id: "complexity.assets.upload_time_10x_ms", unit: "ms", minimumSamples: 1_060 },
  { id: "complexity.assets.upload_time_ratio_10x", unit: "ratio", minimumSamples: 2 },
  ...["library_shelves", "preset_block_list", "preset_live_build", "preset_live_preview"].flatMap((path) => [
    { id: `complexity.dom.${path}_n_300`, unit: "nodes", minimumSamples: 1 },
    { id: `complexity.dom.${path}_n_3000`, unit: "nodes", minimumSamples: 1 },
  ]),
  { id: "complexity.dom.library_shelves_ratio_10x", unit: "ratio", minimum: 0.8, maximum: 1.2, minimumSamples: 2 },
  { id: "complexity.dom.preset_block_list_ratio_10x", unit: "ratio", minimum: 0.8, maximum: 1.2, minimumSamples: 2 },
  { id: "complexity.dom.preset_live_build_ratio_10x", unit: "ratio", minimum: 0.8, maximum: 1.2, minimumSamples: 2 },
  { id: "complexity.dom.preset_live_preview_ratio_10x", unit: "ratio", minimum: 0.8, maximum: 1.2, minimumSamples: 2 },
  { id: "packaged.cli_start_ms", unit: "ms", maximum: 10_000, minimumSamples: 1 },
  { id: "packaged.ui_shell_bytes", unit: "bytes", minimumSamples: 1 },
  { id: "library.first_viewport_art_bytes", unit: "bytes", maximum: 2_000_000, minimumSamples: 1 },
  { id: "preset.light_open_ms", unit: "ms", maximum: 1_500 },
  { id: "character.light_open_ms", unit: "ms", maximum: 300 },
  { id: "save.server_ms", unit: "ms", maximum: 50 },
  { id: "save.keystroke_p95_ms", unit: "ms", maximum: 16, minimumSamples: 10 },
  { id: "heartbeat.frame_gap_p95_ms", unit: "ms", maximum: 100, minimumSamples: 10 },
  { id: "history.growth_per_save_bytes", unit: "bytes", maximum: 100_000 },
  { id: "history.ui_8_kind_growth_per_save_bytes", unit: "bytes", maximum: 100_000, minimumSamples: 240 },
  { id: "restore_30mb_ms", unit: "ms", maximum: 1_000 },
  { id: "trash.round_trip_ms", unit: "ms", maximum: 100 },
  { id: "scene.turn_assembly_ms", unit: "ms", maximum: 300 },
  { id: "import_30mb_server_ms", unit: "ms", maximum: 5_000 },
  { id: "import_30mb_freeze_ms", unit: "ms", maximum: 100 },
  { id: "export_30mb_ms", unit: "ms", maximum: 3_000 },
  { id: "chat.open_4000_ms", unit: "ms", maximum: 250 },
  { id: "chat.swipe_opens", unit: "opens", maximum: 60, minimumSamples: 1 },
  { id: "chat.swipe_route_requests", unit: "requests", maximum: 60, minimumSamples: 1 },
  { id: "search.build_ms", unit: "ms", maximum: 2_000 },
  { id: "search.query_ms", unit: "ms", maximum: 20 },
  { id: "idle.visible_timer_firings_per_minute", unit: "firings/min", maximum: 2, minimumSamples: 55 },
  { id: "idle.hidden_timer_firings_per_minute", unit: "firings/min", maximum: 0, minimumSamples: 55 },
  { id: "idle.visible_server_wakeups_per_minute", unit: "wakeups/min", maximum: 2, minimumSamples: 55 },
  { id: "idle.hidden_server_wakeups_per_minute", unit: "wakeups/min", maximum: 0, minimumSamples: 55 },
  { id: "idle.visible_server_cpu_percent", unit: "%", maximum: 0.5, minimumSamples: 55 },
  { id: "idle.visible_renderer_cpu_percent", unit: "%", maximum: 1, minimumSamples: 55 },
  { id: "idle.hidden_renderer_cpu_percent", unit: "%", maximum: 1, minimumSamples: 55 },
  { id: "browser.dom_nodes.other_editor_screens", unit: "nodes", maximum: 5_000, minimumSamples: 1 },
  { id: "browser.dom_nodes.preset_editor_screen", unit: "nodes", maximum: 5_000, minimumSamples: 1 },
  { id: "idle.browser_rss_steady_bytes", unit: "bytes", minimumSamples: 3 },
  { id: "idle.server_rss_steady_bytes", unit: "bytes", maximum: 350_000_000, minimumSamples: 10 },
  { id: "idle.server_rss_peak_bytes", unit: "bytes", minimumSamples: 55 },
  { id: "idle.browser_rss_peak_bytes", unit: "bytes", minimumSamples: 10 },
  { id: "idle.hidden_server_cpu_percent", unit: "%", maximum: 1, minimumSamples: 55 },
  { id: "import.server_rss_peak_bytes", unit: "bytes", maximum: 900_000_000 },
  { id: "browser.heap_used_bytes", unit: "bytes", maximum: 150_000_000, minimumSamples: 1 },
  { id: "browser.heap_peak_bytes", unit: "bytes", maximum: 300_000_000, minimumSamples: 10 },
  { id: "browser.dom_nodes", unit: "nodes", maximum: 5_000, minimumSamples: 1 },
  { id: "idle.visible_disk_bytes_per_minute", unit: "bytes", maximum: 0, minimumSamples: 1 },
  { id: "idle.hidden_disk_bytes_per_minute", unit: "bytes", maximum: 0, minimumSamples: 1 },
  ...STUDIO_ENTITY_KINDS.flatMap((kind) => [
    { id: `search.ui_${kind}_find_ms`, unit: "ms", minimumSamples: 1 },
    { id: `editor.${kind}.save_click_ms`, unit: "ms", minimumSamples: 1 },
    { id: `editor.${kind}.save_count`, unit: "saves", minimum: 30, maximum: 30, minimumSamples: 30 },
    { id: `roundtrip.${kind}.exact`, unit: "boolean", minimum: 1, maximum: 1, minimumSamples: 1 },
  ]),
  { id: "history.per_kind_version_count", unit: "versions", minimum: 16, minimumSamples: 8 },
  { id: "restore.per_kind_count", unit: "kinds", minimum: 8, maximum: 8, minimumSamples: 8 },
  { id: "restore.per_kind_mean_ms", unit: "ms", maximum: 30_000, minimumSamples: 8 },
  { id: "editor.per_kind_trash_restore_count", unit: "kinds", minimum: 8, minimumSamples: 8 },
];

export interface Metric { value: number; unit: string; samples?: number; method?: string }
export interface Evidence {
  schemaVersion: 1;
  status: "pass" | "fail";
  scope: "dev-server" | "dev-server+compiled-cli-launch";
  packagedProof: "not-run" | "failed" | "compiled-cli-launch";
  packaged: { fileName: string; sha256: string } | null;
  desktopArtifact: { fileName: string; sha256: string; validation: "identity-only" } | null;
  sourceRevision: string;
  sourceDigest: string;
  sourceDirty: boolean;
  capturedAt: string;
  runtime: {
    bun: string;
    browser: string;
    platform: string;
    profile: string;
    cpuCount: number;
    ramBytes: number;
    cpuThrottle: number;
    heapLimitMB: number;
    ciRunner: boolean;
  };
  fixtures: { counts: Record<string, number>; bytes: Record<string, number> };
  metrics: Record<string, Metric>;
  coverage: { uiScreens: string[]; unavailablePaths: string[] };
  budgets: readonly BudgetRow[];
  missing: string[];
  failures: string[];
}

export function assess(metrics: Record<string, Metric>): { missing: string[]; failures: string[] } {
  const missing = BUDGETS.filter((budget) => {
    const metric = metrics[budget.id];
    return !metric || !Number.isFinite(metric.value) || metric.unit !== budget.unit ||
      (budget.minimumSamples !== undefined && (!Number.isSafeInteger(metric.samples) || metric.samples! < budget.minimumSamples));
  }).map(({ id }) => id);
  const failures = BUDGETS.flatMap((budget) => {
    const metric = metrics[budget.id];
    if (!metric || !Number.isFinite(metric.value) || metric.unit !== budget.unit) return [];
    if (metric.value < 0) return [`${budget.id}: negative ${metric.value} ${budget.unit} is invalid evidence`];
    return [
      ...(budget.minimum !== undefined && metric.value < budget.minimum ? [`${budget.id}: ${metric.value} ${budget.unit} < ${budget.minimum} ${budget.unit}`] : []),
      ...(budget.maximum !== undefined && metric.value > budget.maximum ? [`${budget.id}: ${metric.value} ${budget.unit} > ${budget.maximum} ${budget.unit}`] : []),
    ];
  });
  return { missing, failures };
}
