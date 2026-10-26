/**
 * Settings > Connections: MCP in both directions.
 *
 * CONSUMING - servers this machine runs so their tools join Kit's belt. An entry IS a command this
 * machine executes, which shapes everything here: the whole /api/mcp/ surface is host-only, env
 * values go in and never come back (key names only, the vault's rule), and every external tool runs
 * as `egress` - confirmed at the Gate, never silently.
 *
 * SERVING - the other way around: any MCP client can use Bunraku's belt via `bunraku mcp`. That
 * side needs no state here; the card shows the command to register, with this studio's real path.
 */
import { useCallback, useEffect, useState, type JSX } from "react";
import { apiFetchJson } from "../../../_shared/api-fetch";
import { toErrorMessage } from "../../../_shared/error-message";
import { protect } from "../../../_shared/protected-control";
import { Button } from "../../../components/button";
import { SettingsRow, type SettingsSection } from "../section-contract";
import styles from "./connections.module.css";

interface ServerRow {
  id: string;
  command: string;
  args: string[];
  envKeys: string[];
  enabled: boolean;
  status: { state: "connected" | "failed"; tools: number; dropped: number; detail?: string } | null;
}

interface ListReply {
  servers: ServerRow[];
  rejected: string[];
  configPath: string;
}

interface Draft {
  id: string;
  command: string;
  /** space-separated on screen; split for the wire */
  args: string;
  /** KEY=VALUE lines; blank = keep whatever is saved */
  env: string;
}

const emptyDraft: Draft = { id: "", command: "", args: "", env: "" };

/** KEY=VALUE lines to a record; a line without "=" is reported rather than guessed at. */
export function parseEnvLines(text: string): { env: Record<string, string> } | { bad: string } {
  const env: Record<string, string> = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const cut = line.indexOf("=");
    if (cut <= 0) return { bad: line };
    env[line.slice(0, cut).trim()] = line.slice(cut + 1);
  }
  return { env };
}

function ConnectionsSection(): JSX.Element {
  const [rows, setRows] = useState<ServerRow[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingExisting, setEditingExisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [tested, setTested] = useState<Record<string, string>>({});
  const [studioDir, setStudioDir] = useState("");

  const take = useCallback((reply: ListReply): void => {
    setRows(reply.servers);
    setRejected(reply.rejected);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        take(await apiFetchJson<ListReply>("/api/mcp/servers"));
      } catch (error) {
        setProblem(toErrorMessage(error, "could not read the server list"));
      }
      try {
        const v = await apiFetchJson<{ studioDir?: string }>("/api/version");
        setStudioDir(v.studioDir ?? "");
      } catch {
        /* the snippet just shows a placeholder */
      }
    })();
  }, [take]);

  const post = async (path: string, body: unknown, then?: string): Promise<void> => {
    setBusy(true);
    setProblem(null);
    try {
      take(await apiFetchJson<ListReply>(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }));
      if (then !== undefined) setProblem(null);
    } catch (error) {
      setProblem(toErrorMessage(error, "that did not work"));
    } finally {
      setBusy(false);
    }
  };

  const save = async (): Promise<void> => {
    if (!draft) return;
    const env = parseEnvLines(draft.env);
    if ("bad" in env) {
      setProblem(`env lines are KEY=VALUE; "${env.bad}" is not`);
      return;
    }
    const body: Record<string, unknown> = {
      id: draft.id.trim(),
      command: draft.command.trim(),
      args: draft.args.split(/\s+/).filter(Boolean),
      enabled: true,
    };
    // Blank env on an EXISTING server keeps the saved values (the browser never saw them and must
    // not erase them); on a new one blank simply means none.
    if (draft.env.trim() !== "" || !editingExisting) body["env"] = "bad" in env ? {} : env.env;
    await post("/api/mcp/servers", body);
    setDraft(null);
  };

  const test = async (id: string): Promise<void> => {
    setTested((prior) => ({ ...prior, [id]: "spawning..." }));
    try {
      const reply = await apiFetchJson<{ ok: boolean; tools: number; dropped: number; detail?: string }>(
        "/api/mcp/test",
        { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) },
      );
      setTested((prior) => ({
        ...prior,
        [id]: reply.ok
          ? `${reply.tools} tool(s)${reply.dropped > 0 ? `, ${reply.dropped} malformed` : ""}`
          : (reply.detail ?? "could not connect"),
      }));
    } catch (error) {
      setTested((prior) => ({ ...prior, [id]: toErrorMessage(error, "no answer") }));
    }
  };

  const serveSnippet = `claude mcp add bunraku -- bunraku mcp "${studioDir || "<your studio folder>"}"`;

  return (
    <div {...protect("mcp-connections")}>
      <SettingsRow
        label="MCP servers"
        hint="Programs this machine runs so their tools join Kit's belt. Every external tool asks at the Gate before it runs."
      >
        <span />
      </SettingsRow>

      {rejected.map(/* bounded-ok: fixed options, per-finding detail, or short word lists */ (line) => <p key={line} className={styles.problem}>{line}</p>)}

      <ul className={styles.list}>
        {rows.length === 0 && <li className={styles.empty}>No servers connected yet.</li>}
        {rows.map(/* bounded-ok: fixed category set, per-item detail, capped or short by construction */ (row) => (
          <li key={row.id} className={styles.row}>
            <span className={styles.name}>{row.id}</span>
            <span className={styles.command}>{[row.command, ...row.args].join(" ")}</span>
            <span className={row.status?.state === "connected" ? styles.good : styles.state}>
              {!row.enabled
                ? "off"
                : row.status?.state === "connected"
                  ? `${row.status.tools} tool(s)`
                  : (row.status?.detail ?? "not connected")}
            </span>
            {/* Key NAMES only; the values never come back from the server. */}
            {row.envKeys.length > 0 && <span className={styles.env}>{`env: ${row.envKeys.join(", ")}`}</span>}
            <span className={styles.acts}>
              <Button size="sm" disabled={busy} onClick={() => { void test(row.id); }}>{"Test"}</Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => {
                  void post("/api/mcp/servers", {
                    id: row.id, command: row.command, args: row.args, enabled: !row.enabled,
                  });
                }}
              >
                {row.enabled ? "Disable" : "Enable"}
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => {
                  setEditingExisting(true);
                  setDraft({ id: row.id, command: row.command, args: row.args.join(" "), env: "" });
                }}
              >
                {"Edit"}
              </Button>
              <Button size="sm" variant="danger" disabled={busy} onClick={() => { void post("/api/mcp/servers/remove", { id: row.id }); }}>
                {"Remove"}
              </Button>
            </span>
            {tested[row.id] && <span className={styles.tested}>{tested[row.id]}</span>}
          </li>
        ))}
      </ul>

      {draft === null ? (
        <div className={styles.add}>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => { setEditingExisting(false); setDraft(emptyDraft); }}
          >
            {"Add a server"}
          </Button>
        </div>
      ) : (
        <div className={styles.form}>
          <label>
            {"Name"}
            <input
              value={draft.id}
              placeholder="my-tools"
              disabled={editingExisting}
              onChange={(e) => { setDraft({ ...draft, id: e.target.value }); }}
            />
          </label>
          <label>
            {"Command"}
            <input
              value={draft.command}
              placeholder="C:\\path\\to\\server.exe or uvx"
              onChange={(e) => { setDraft({ ...draft, command: e.target.value }); }}
            />
          </label>
          <label>
            {"Arguments"}
            <input
              value={draft.args}
              placeholder="--from git+https://... server-cmd"
              onChange={(e) => { setDraft({ ...draft, args: e.target.value }); }}
            />
          </label>
          <label>
            {"Environment (KEY=VALUE per line)"}
            <textarea
              value={draft.env}
              rows={3}
              spellCheck={false}
              placeholder={editingExisting ? "leave blank to keep the saved values" : "API_KEY=..."}
              onChange={(e) => { setDraft({ ...draft, env: e.target.value }); }}
            />
          </label>
          <div className={styles.formActs}>
            <Button variant="primary" disabled={busy} onClick={() => { void save(); }}>{"Save"}</Button>
            <Button variant="quiet" disabled={busy} onClick={() => { setDraft(null); setProblem(null); }}>{"Cancel"}</Button>
          </div>
        </div>
      )}

      <SettingsRow
        label="Bunraku as a server"
        hint="Point any MCP client at Bunraku's own belt: the library, catalogs and renderers. Your client asks before each tool runs."
      >
        <code className={styles.snippet}>{serveSnippet}</code>
      </SettingsRow>

      {problem !== null && <p className={styles.problem}>{problem}</p>}
    </div>
  );
}

const section: SettingsSection = {
  id: "connections",
  act: "agent",
  title: "Connections",
  lede: "MCP in both directions: servers this machine runs so their tools join Kit's belt, and Bunraku's own belt for any MCP client.",
  protectedNote: "An entry is a command this machine executes. Host only; environment values go in and never come back, only key names do. Every external tool asks at the Gate before it runs.",
  label: "Connections",
  // Beside Models: both answer "what can the agent reach", and somebody wiring one wires the other.
  order: 16,
  Component: ConnectionsSection,
};

export default section;
