import { createClient } from "@supabase/supabase-js";
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

function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
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

async function ensureSupabaseSnapshot(client) {
  const { data, error } = await client
    .from("mission_snapshots")
    .select("id, state_json, updated_at, updated_by")
    .eq("id", SNAPSHOT_ID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data) {
    return {
      state: processState(data.state_json),
      updatedAt: data.updated_at,
      updatedBy: data.updated_by
    };
  }

  return writeMissionState(createDefaultState(), {
    actor: "bootstrap",
    action: "bootstrap"
  });
}

export async function readMissionState() {
  const client = getSupabaseServerClient();
  if (!client) {
    const store = getMemoryStore();
    return store.snapshot;
  }

  return ensureSupabaseSnapshot(client);
}

export async function readAuditLog(limit = 20) {
  const client = getSupabaseServerClient();
  if (!client) {
    const store = getMemoryStore();
    return store.audit.slice(0, limit);
  }

  const { data, error } = await client
    .from("mission_audit_log")
    .select("id, action, actor, details, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return data;
}

export async function writeMissionState(candidateState, options = {}) {
  const actor = options.actor || "administrator";
  const action = options.action || "state.update";
  const state = processState(candidateState);
  const auditDetails = buildAuditDetails(state, options.details);
  const client = getSupabaseServerClient();
  const updatedAt = new Date().toISOString();

  if (!client) {
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

  const { data, error } = await client
    .from("mission_snapshots")
    .upsert({
      id: SNAPSHOT_ID,
      state_json: state,
      updated_at: updatedAt,
      updated_by: actor
    })
    .select("state_json, updated_at, updated_by")
    .single();

  if (error) {
    throw error;
  }

  const { error: auditError } = await client
    .from("mission_audit_log")
    .insert({
      action,
      actor,
      details: auditDetails
    });

  if (auditError) {
    throw auditError;
  }

  return {
    state: processState(data.state_json),
    updatedAt: data.updated_at,
    updatedBy: data.updated_by
  };
}
