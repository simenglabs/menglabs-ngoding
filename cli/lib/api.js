import { loadConfig } from "./config.js";

export async function apiFetch(
  path,
  { method = "GET", body, apiBase, apiKey } = {},
) {
  const cfg = loadConfig();
  const base = (apiBase || cfg.apiBase).replace(/\/$/, "");
  const key = apiKey || cfg.apiKey;
  const headers = { "Content-Type": "application/json" };
  if (key) headers["Authorization"] = `Bearer ${key}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let r;
  try {
    r = await fetch(`${base}${path}`, {
      method,
      headers,
      signal: controller.signal,
      body: body ? JSON.stringify(body) : undefined,
    });
  } finally {
    clearTimeout(timeout);
  }
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!r.ok)
    throw new Error(
      `${r.status} ${path} ${JSON.stringify(data).slice(0, 400)}`,
    );
  return data;
}

export async function listTasks({
  status = "todo",
  perencanaanId,
  limit = 20,
} = {}) {
  const cfg = loadConfig();
  const pid = perencanaanId || cfg.perencanaanId;
  let q = `?status=${status}&limit=${limit}`;
  if (pid) q += `&perencanaanId=${pid}`;
  return apiFetch(`/api/agent/tasks${q}`);
}

export async function claimNext(
  perencanaanId,
  { claim = true, workerId } = {},
) {
  const cfg = loadConfig();
  const pid = perencanaanId || cfg.perencanaanId;
  return apiFetch("/api/agent/tasks", {
    method: "POST",
    body: { perencanaanId: pid, claim, workerId },
  });
}

export async function setStatus(id, status, { claimToken, result } = {}) {
  return apiFetch("/api/agent/tasks", {
    method: "PATCH",
    body: { id, status, claimToken, result },
  });
}

export async function listPerencanaan() {
  return apiFetch("/api/agent/perencanaan");
}
