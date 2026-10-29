# RoleCall assembler recorder

Records what RoleCall's prompt assembler produces for each fixture, so Bunzai's port has a fixed
target to match. Nothing here ships or runs in Bunzai's
suite; Bunzai's parity tests read the committed `fixtures/` and `recorded/`.

PIN=68afe385987811c4c1b8594013b27e75bebbe8f2

## Running it

`tools/rc-recorder/run.sh <dir>`, where `<dir>` is a RoleCall checkout at the commit named by `PIN`. It refuses any other commit, copies the recorder in, runs it under RoleCall's own vitest, writes `recorded/`, and removes its copy.

Moving the pin is deliberate: change `PIN` here, re-record, and review every changed output as a RoleCall behavior change.

## What makes a recording trustworthy

- The database double (`fake-supabase.ts`) fails closed: any table, rpc, or query method the fixture
  does not declare throws. A fixture declares a table it expects to be empty as `[]`.
- The clock, `Math.random`, and `crypto.randomUUID` are frozen per fixture (`now`, `seed`).
- Each fixture runs 15 times and every run must match, or it fails.
- Writes are recorded, not applied. They are output: macro state persisted by a turn is a contract.

## A fixture

`fixtures/<name>.json`: `name`, `about`, `now`, `seed`, `db` (`userId`, `tables`, `rpc`), and `input`
(RoleCall's `PromptAssemblyInput`, minus `databaseAuthority`, which the recorder sets).
