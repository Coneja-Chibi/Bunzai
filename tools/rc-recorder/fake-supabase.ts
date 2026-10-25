/**
 * A Supabase client double for recording RoleCall's prompt assembler, and it fails closed. A table or
 * rpc the fixture does not declare throws, and so does any query method this double does not model,
 * so a recording can never quietly capture a prompt starved of data it asked for. Reads filter the
 * fixture's rows; writes are recorded (they are part of the output: macro state is a contract) and
 * never applied. Runs inside a RoleCall checkout under vitest; see README.md.
 */

export type Row = Record<string, unknown>;

export interface FakeDb {
  /** Every table the assembler may read. An empty array is a declared, empty table. */
  tables: Record<string, Row[]>;
  /** Every rpc the assembler may call, with the data it answers. */
  rpc: Record<string, unknown>;
  userId: string;
}

export interface RecordedWrite {
  table: string;
  op: "insert" | "upsert" | "update" | "delete";
  payload?: unknown;
  filters: Array<[string, string, unknown]>;
}

export interface FakeClient {
  client: unknown;
  writes: RecordedWrite[];
  reads: string[];
  /** Every refusal, even one RoleCall caught and recovered from; a recording with any is rejected. */
  refusals: string[];
}

type Filter = [op: string, column: string, value: unknown];

const matches = (row: Row, [op, column, value]: Filter): boolean => {
  const cell = row[column];
  switch (op) {
    case "eq":
      return cell === value;
    case "neq":
      return cell !== value;
    case "in":
      return (value as unknown[]).includes(cell);
    case "is":
      return value === null ? cell === null || cell === undefined : cell === value;
    default:
      refuse(`fake-supabase: filter ${op} is not modeled`);
  }
};

export function fakeSupabase(db: FakeDb): FakeClient {
  const writes: RecordedWrite[] = [];
  const reads: string[] = [];
  const refusals: string[] = [];
  const refuse = (message: string): never => {
    refusals.push(message);
    throw new Error(message);
  };

  const query = (table: string) => {
    if (!(table in db.tables)) refuse(`fake-supabase: table "${table}" is not declared by the fixture`);
    const filters: Filter[] = [];
    let write: RecordedWrite | null = null;
    let order: { column: string; ascending: boolean } | null = null;
    let limit: number | null = null;

    const rows = (): Row[] => {
      let out = db.tables[table]!.filter((row) => filters.every((f) => matches(row, f)));
      if (order) {
        const { column, ascending } = order;
        out = [...out].sort((a, b) => (String(a[column]) < String(b[column]) ? -1 : 1) * (ascending ? 1 : -1));
      }
      return limit === null ? out : out.slice(0, limit);
    };
    const settle = (shape: "many" | "maybe" | "single") => {
      if (write) {
        write.filters = filters.map(([op, c, v]) => [op, c, v]);
        writes.push(write);
        return { data: null, error: null };
      }
      reads.push(table);
      const found = rows();
      if (shape === "many") return { data: found, error: null };
      if (found.length > 1) return { data: null, error: { message: `fake-supabase: ${found.length} rows for a single read of ${table}` } };
      if (shape === "single" && found.length === 0) return { data: null, error: { message: `fake-supabase: no row in ${table}` } };
      return { data: found[0] ?? null, error: null };
    };

    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (c: string, v: unknown) => (filters.push(["eq", c, v]), builder),
      neq: (c: string, v: unknown) => (filters.push(["neq", c, v]), builder),
      in: (c: string, v: unknown[]) => (filters.push(["in", c, v]), builder),
      is: (c: string, v: unknown) => (filters.push(["is", c, v]), builder),
      order: (column: string, opts?: { ascending?: boolean }) => ((order = { column, ascending: opts?.ascending !== false }), builder),
      limit: (n: number) => ((limit = n), builder),
      insert: (payload: unknown) => ((write = { table, op: "insert", payload, filters: [] }), builder),
      upsert: (payload: unknown) => ((write = { table, op: "upsert", payload, filters: [] }), builder),
      update: (payload: unknown) => ((write = { table, op: "update", payload, filters: [] }), builder),
      delete: () => ((write = { table, op: "delete", filters: [] }), builder),
      maybeSingle: () => Promise.resolve(settle("maybe")),
      single: () => Promise.resolve(settle("single")),
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        try {
          return Promise.resolve(settle("many")).then(resolve, reject);
        } catch (e) {
          return reject ? Promise.reject(e).catch(reject) : Promise.reject(e);
        }
      },
    };
    return new Proxy(builder, {
      get(target, key) {
        if (typeof key === "symbol" || key in target) return target[key as string];
        refuse(`fake-supabase: query method .${key}() on "${table}" is not modeled`);
      },
    });
  };

  const client = {
    from: query,
    rpc: (name: string) => {
      if (!(name in db.rpc)) refuse(`fake-supabase: rpc "${name}" is not declared by the fixture`);
      reads.push(`rpc:${name}`);
      return Promise.resolve({ data: db.rpc[name], error: null });
    },
    auth: { getUser: () => Promise.resolve({ data: { user: { id: db.userId } }, error: null }) },
  };
  return {
    client: new Proxy(client, {
      get(target, key) {
        if (typeof key === "symbol" || key in target) return target[key as keyof typeof target];
        refuse(`fake-supabase: client.${String(key)} is not modeled`);
      },
    }),
    writes,
    reads,
    refusals,
  };
}
