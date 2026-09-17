#!/usr/bin/env python3
"""Read-only API example. It never claims or completes a task."""
import json
import os
import urllib.parse
import urllib.request

base = os.getenv("MENGLABS_API", os.getenv("API_BASE", "http://localhost:5173"))
token = os.getenv("MENGLABS_KEY", os.getenv("AGENT_API_KEY"))
plan = os.getenv("MENGLABS_PERENCANAAN")
if not token:
    raise SystemExit("Set MENGLABS_KEY to a project-scoped token from the Implementasi page.")
params = {"status": "todo", "limit": "5"}
if plan:
    params["perencanaanId"] = plan
request = urllib.request.Request(f"{base}/api/agent/tasks?{urllib.parse.urlencode(params)}", headers={"Authorization": f"Bearer {token}"})
with urllib.request.urlopen(request, timeout=30) as response:
    print(json.dumps(json.load(response), indent=2))
print("Read-only example: no task was claimed or completed. Use the maintained CLI runner for execution.")
