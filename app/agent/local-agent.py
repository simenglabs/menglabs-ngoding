#!/usr/bin/env python3
"""
Local AI Agent — auto collect todo -> doing -> done
Polling kanban_task di SQLite via HTTP API.

Usage:
  export AGENT_API_KEY=sk-agent-local-2026
  export API_BASE=http://localhost:5173
  python agent/local-agent.py              # auto claim 1 todo tiap loop
  python agent/local-agent.py --once       # sekali jalan
  python agent/local-agent.py --perencanaan f2a87ca7...  # filter 1 perencanaan

Flow otomatis:
  1. GET /api/agent/tasks?status=todo  (collect)
  2. POST /api/agent/tasks  {claim:true} -> todo jadi doing (auto)
  3. kerjakan task (di sini simulasi / panggil LLM / coding agent)
  4. PATCH /api/agent/tasks  {id, status:"done"}  (atau "doing" selama proses)

Kanban otomatis berubah karena DB status update, frontend polls atau drag.
"""
import os, time, argparse, requests, sys

API_BASE = os.getenv("API_BASE", "http://localhost:5173")
AGENT_KEY = os.getenv("AGENT_API_KEY", "sk-agent-local-2026")

HEADERS = {"Authorization": f"Bearer {AGENT_KEY}", "Content-Type": "application/json"}

def api(method, path, **kw):
    kw.setdefault("headers", HEADERS)
    r = requests.request(method, f"{API_BASE}{path}", **kw)
    if r.status_code >= 400:
        print(f"[error] {method} {path} {r.status_code} {r.text[:300]}", file=sys.stderr)
    return r

def collect_todo(perencanaan_id=None, limit=5):
    q = f"?status=todo&limit={limit}"
    if perencanaan_id: q += f"&perencanaanId={perencanaan_id}"
    r = api("GET", f"/api/agent/tasks{q}")
    return r.json().get("tasks", []) if r.ok else []

def claim_next(perencanaan_id=None):
    r = api("POST", "/api/agent/tasks", json={"perencanaanId": perencanaan_id, "claim": True})
    return r.json().get("task") if r.ok else None

def set_status(task_id, status):
    r = api("PATCH", "/api/agent/tasks", json={"id": task_id, "status": status})
    return r.ok

def do_work(task):
    """Ganti isi ini dengan agent kamu: panggil LLM, generate code, run tests, dll."""
    print(f"  → kerjakan: {task['title']} [{task['priority']}/{task['estimate']}]")
    print(f"    fitur: {task.get('fiturTitle')} / sub: {task.get('subFiturTitle')}")
    # simulasi kerja 2 detik
    time.sleep(2)
    # di real: hasil kerja -> tulis file, commit, push
    return True

def run_loop(perencanaan_id, poll_sec=4, once=False):
    print(f"[agent] API_BASE={API_BASE} perencanaan={perencanaan_id or 'all'}")
    while True:
        todos = collect_todo(perencanaan_id, limit=5)
        print(f"[poll] {len(todos)} todo")
        if not todos:
            print("  idle, tunggu task baru...")
            if once: break
            time.sleep(poll_sec); continue

        # claim 1 paling lama (FIFO) -> status jadi doing otomatis
        task = claim_next(perencanaan_id)
        if not task:
            print("  nothing to claim")
            time.sleep(poll_sec); continue

        print(f"[claimed] {task['id'][:8]} {task['title']} -> doing")
        # auto doing sudah set oleh claim

        ok = do_work(task)

        if ok:
            set_status(task["id"], "done")
            print(f"[done] {task['id'][:8]} -> done ✓")
        else:
            set_status(task["id"], "todo")
            print(f"[fail] kembalikan ke todo")

        if once: break
        time.sleep(1)

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--perencanaan", help="filter perencanaanId")
    p.add_argument("--once", action="store_true", help="sekali claim saja")
    p.add_argument("--poll", type=int, default=4, help="interval poll detik")
    args = p.parse_args()
    try:
        run_loop(args.perencanaan, poll_sec=args.poll, once=args.once)
    except KeyboardInterrupt:
        print("\n[agent] stop")
