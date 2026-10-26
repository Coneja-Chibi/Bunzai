/** Keep the Studio's list virtualization behind one shared owner so sizing, focus retention, and
 * keyboard traversal stay consistent as new long views are added. Register with the source gates. */
const files = [
  ...new Bun.Glob("src/ui/**/*.ts").scanSync("."),
  ...new Bun.Glob("src/ui/**/*.tsx").scanSync("."),
].map((file) => file.replace(/\\/g, "/")).filter((file) => file !== "src/ui/_shared/virtual-list/core.tsx");
const violations: string[] = [];
for (const file of files) {
  const source = await Bun.file(file).text();
  if (/\b(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)["']@tanstack\/react-virtual["']/.test(source)) violations.push(file);
}
if (violations.length) {
  console.error(`Import @tanstack/react-virtual only from src/ui/_shared/virtual-list/core.tsx:\n${violations.map((f) => `  ${f}`).join("\n")}`);
  process.exitCode = 1;
} else console.log("virtualizer-boundary: clean");
