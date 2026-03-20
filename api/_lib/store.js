import { neon } from "@neondatabase/serverless";
import { createDefaultState, processState } from "../../shared/mission-core.js";

const SNAPSHOT_ID = "global";

function getMemoryStore() {
  if (!globalThis.__spaceMissionStore) {
    const state = processState(createDefaultState());
    globalThis.__spaceMissionStore = {
      snapshot: {
        state,
        updatedAt: new Date().toISOString(),
        updatedBy: "memory-bootstrap"
      },
      audit: [
        {
          id: 1,
          action: "bootstrap",
          actor: "memory-bootstrap",
          details: {
            satelliteCount: state.satellites.length,
            launchCount: state.launches.length,
            catastropheCount: state.catastrophes.length
          },
          created_at: new Date().toISOString()
        }
      ]
    };
  }

  return globalThis.__spaceMissionStore;
}

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
    ""
  );
}

function getNeonSql() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    return null;
  }

  return neon(databaseUrl);
}

function parseJsonValue(value, fallback = {}) {
  if (!value) {
    return fallback;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  return value;
}

function buildAuditDetails(state, details = {}) {
  return {
    satelliteCount: state.satellites.length,
    launchCount: state.launches.length,
    catastropheCount: state.catastrophes.length,
    changeAlertCount: state.changeAlerts.length,
    theme: state.theme,
    ...details
  };
}

async function ensureNeonSchema(sql) {
  if (!globalThis.__spaceMissionSchemaPromise) {
    globalThis.__spaceMissionSchemaPromise = (async () => {
      await sql`
        create table if not exists mission_snapshots (
          id text primary key,
          state_json jsonb not null,
          updated_at timestamptz not null default timezone('utc', now()),
          updated_by text not null default 'bootstrap'
        )
      `;

      await sql`
        create table if not exists mission_audit_log (
          id bigint generated always as identity primary key,
          action text not null,
          actor text not null,
          details jsonb not null default '{}'::jsonb,
          created_at timestamptz not null default timezone('utc', now())
        )
      `;
    })().catch((error) => {
      globalThis.__spaceMissionSchemaPromise = null;
      throw error;
    });
  }

  await globalThis.__spaceMissionSchemaPromise;
}

async function ensureNeonSnapshot(sql) {
  await ensureNeonSchema(sql);

  const rows = await sql`
    select id, state_json, updated_at, updated_by
    from mission_snapshots
    where id = ${SNAPSHOT_ID}
    limit 1
  `;

  if (rows.length) {
    return {
      state: processState(parseJsonValue(rows[0].state_json, createDefaultState())),
      updatedAt: rows[0].updated_at,
      updatedBy: rows[0].updated_by
    };
  }

  return writeMissionState(createDefaultState(), {
    actor: "bootstrap",
    action: "bootstrap"
  });
}

export async function readMissionState() {
  const sql = getNeonSql();
  if (!sql) {
    const store = getMemoryStore();
    return store.snapshot;
  }

  return ensureNeonSnapshot(sql);
}

export async function readAuditLog(limit = 20) {
  const sql = getNeonSql();
  if (!sql) {
    const store = getMemoryStore();
    return store.audit.slice(0, limit);
  }

  await ensureNeonSchema(sql);
  const boundedLimit = Math.max(1, Math.min(100, Number(limit) || 20));

  const rows = await sql`
    select id, action, actor, details, created_at
    from mission_audit_log
    order by created_at desc
    limit ${boundedLimit}
  `;

  return rows.map((row) => ({
    ...row,
    details: parseJsonValue(row.details, {})
  }));
}

export async function writeMissionState(candidateState, options = {}) {
  const actor = options.actor || "administrator";
  const action = options.action || "state.update";
  const state = processState(candidateState);
  const auditDetails = buildAuditDetails(state, options.details);
  const sql = getNeonSql();
  const updatedAt = new Date().toISOString();

  if (!sql) {
    const store = getMemoryStore();
    store.snapshot = {
      state,
      updatedAt,
      updatedBy: actor
    };
    store.audit.unshift({
      id: Date.now(),
      action,
      actor,
      details: auditDetails,
      created_at: updatedAt
    });
    store.audit = store.audit.slice(0, 50);
    return store.snapshot;
  }

  await ensureNeonSchema(sql);

  const rows = await sql`
    insert into mission_snapshots (id, state_json, updated_at, updated_by)
    values (${SNAPSHOT_ID}, ${JSON.stringify(state)}::jsonb, ${updatedAt}::timestamptz, ${actor})
    on conflict (id)
    do update set
      state_json = excluded.state_json,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by
    returning state_json, updated_at, updated_by
  `;

  await sql`
    insert into mission_audit_log (action, actor, details)
    values (${action}, ${actor}, ${JSON.stringify(auditDetails)}::jsonb)
  `;

  return {
    state: processState(parseJsonValue(rows[0]?.state_json, state)),
    updatedAt: rows[0]?.updated_at || updatedAt,
    updatedBy: rows[0]?.updated_by || actor
  };
}
