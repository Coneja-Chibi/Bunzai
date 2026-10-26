/**
 * Lint law, scoped tight ON PURPOSE: only the failure classes that types and tests cannot catch -
 * React dispatcher corruption (rules-of-hooks, effect-dependency echo loops) and reinvention of a
 * house primitive an app should compose, not hand-roll. This is a GATE, not a style tool: style
 * stays the house doctrine, enforced by review and the scripts/hooks detectors. Runs on authored
 * TypeScript across the Studio and Kit via pre-commit, and lights up in-editor (the reason it
 * survives what the catalog --digest cannot:
 * a linter rule lives outside the agent's context, so compaction can't wipe it and it can't be
 * walked past without an explicit, reviewable eslint-disable). The Studio and Kit are both React
 * surfaces, so the dispatcher rules cover both trees.
 */
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

/**
 * House primitives an app/shell surface must COMPOSE, never render raw. Each becomes a
 * no-restricted-syntax rule that fires on the JSX usage (not the import), so it catches the
 * always-open misuse - not just the import line - and names the compact alternative right in the
 * error. A genuine raw use inside an open-gated popover stays legal, but must earn a one-line
 * `// eslint-disable-next-line no-restricted-syntax -- <reason>`. Grow this list, not the escapes.
 */
const COMPOSE_NOT_RAW = [
  {
    element: "ColorPicker",
    use: "Use <SwatchRow> for a single color (compact preset tiles + custom popover) or <PaintPicker> for solid/gradient",
  },
];

const restrictedPrimitives = COMPOSE_NOT_RAW.map(({ element, use }) => ({
  selector: `JSXOpeningElement[name.name='${element}']`,
  message: `Raw <${element}> in an app/shell surface. ${use}. Only render it raw inside an open-gated popover, and then add an eslint-disable with a reason. Catalog: docs/reference/components.md.`,
}));

/** Native elements that dodge the component-name rules above but still reinvent a house
 *  primitive. The palette hand-roll walked through exactly this gap with <input type="color">. */
const NATIVE_REINVENTIONS = [
  {
    selector: "JSXOpeningElement[name.name='input']:has(JSXAttribute[name.name='type'] Literal[value='color'])",
    message: "Raw <input type=\"color\"> in an app/shell surface. Use <SwatchRow> for a single color, <PaletteControl> for named swatches, or <PaintPicker> for solid/gradient. Catalog: docs/reference/components.md.",
  },
];

/** A raw <button> outside the button family: the audit found ~1,400 room-made buttons in a dozen looks. */
const RAW_BUTTON = {
  selector: "JSXOpeningElement[name.name='button']",
  message: "Raw <button>. Use the button family (src/ui/components/button): Button, IconButton, Segmented, Tabs, DocTab, Chip, ListRow, MenuItem, Disclosure, Tile, Card, Dot, Toggle, InlineValue or Scrim. Wireframe: design/wireframes/features/button-family.",
};

export default [
  {
    files: ["src/ui/**/*.{ts,tsx}", "src/kit/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      // conditional/looped hooks corrupt React's dispatcher state: always an error
      "react-hooks/rules-of-hooks": "error",
      // missing/lying deps are the echo-loop breeding ground; warn (the ctx pattern has one
      // documented mount-once exception, disabled inline with its reason)
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // reinvention gate: only apps and shell (components/ is where primitives legitimately compose)
    files: ["src/ui/apps/**/*.tsx", "src/ui/shell/**/*.tsx"],
    ignores: ["**/*.test.tsx"],
    rules: {
      "no-restricted-syntax": ["error", ...restrictedPrimitives, ...NATIVE_REINVENTIONS, RAW_BUTTON],
    },
  },
  {
    // the button family is the only place a <button> is drawn; every other studio surface composes it
    files: ["src/ui/**/*.tsx"],
    ignores: ["src/ui/apps/**", "src/ui/shell/**", "src/ui/components/button/**", "**/*.test.tsx"],
    rules: {
      "no-restricted-syntax": ["error", RAW_BUTTON],
    },
  },
];
