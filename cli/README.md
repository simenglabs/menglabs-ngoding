# menglabs-ngoding — npx CLI sync hosted ↔ local

> `npx menglabs-ngoding@latest <command>` — bebas pakai agent CLI kamu (Claude, Antigravity, Cursor, OpenCode)

## Install (sekali)
```bash
npx menglabs-ngoding@latest --help
# atau install global
npm i -g menglabs-ngoding
menglabs-ngoding --help
```

## Setup — hubungkan ke platform hosted
Platform kamu di-host (mis `https://ngoding.menglabs.id` atau `http://localhost:5173` dev):

```bash
# simpan ke ~/.menglabs/config.json (global) + ./.menglabs.json (local)
npx menglabs-ngoding init --url https://ngoding.menglabs.id --key sk-agent-local-2026 --perencanaan f2a87ca7 --global

# cek
npx menglabs-ngoding config
npx menglabs-ngoding sync
```

Atau pakai env (tanpa file):
```bash
export MENGLABS_API=https://ngoding.menglabs.id
export MENGLABS_KEY=sk-agent-local-2026
export MENGLABS_PERENCANAAN=f2a87ca7-f298-49f5-9223-ee0c23e2620d
```

## Perintah

```bash
# lihat perencanaan
npx menglabs-ngoding perencanaan
# lihat tasks (kanban)
npx menglabs-ngoding tasks --status todo
npx menglabs-ngoding tasks --status doing --json
# claim 1 todo terlama -> jadi doing (otomatis)
npx menglabs-ngoding claim --perencanaan <id>
# set status manual
npx menglabs-ngoding done <taskId>
npx menglabs-ngoding doing <taskId>
```

## Bebas pakai agent CLI kamu — auto todo → doing → done

CLI `run` akan: poll todo → claim (todo→doing) → jalankan command kamu per task → jika sukses set done, gagal balik todo.

```bash
# Claude Code
npx menglabs-ngoding run --exec 'npx @anthropic-ai/claude-code -p "kerjakan {{title}}: {{description}} (fitur {{fitur}})"' --perencanaan <id>

# Antigravity
npx menglabs-ngoding run --agent antigravity --perencanaan <id>
# sama dengan:
npx menglabs-ngoding run --exec 'antigravity run --task "{{title}}"' 

# Cursor
npx menglabs-ngoding run --exec 'cursor-agent "{{title}}: {{description}}"' --once

# Custom script kamu
npx menglabs-ngoding run --exec 'python agent/local-agent.py --task "{{id}}"' --poll 5

# Dry run (tidak ubah status)
npx menglabs-ngoding run --exec 'echo {{title}}' --dry --once
```

Template vars: `{{title}} {{description}} {{id}} {{fitur}} {{subFitur}}`
Env diset per task: `TASK_ID, TASK_TITLE, TASK_DESC, TASK_JSON`

## Sync otomatis
- Hosted platform = sumber kebenaran (SQLite `kanban_task` via `POST /api/plan` & `POST /api/tasks`)
- Local `npx menglabs-ngoding` poll `GET /api/agent/tasks?status=todo` tiap 4 detik (--poll)
- Claim atomik `POST /api/agent/tasks` (todo→doing), `PATCH /api/agent/tasks` (doing→done)
- Kanban di browser auto update (drag atau refresh), status sinkron DB.

## API langsung (tanpa CLI)
```bash
curl -H "Authorization: Bearer sk-agent-local-2026" http://localhost:5173/api/agent/tasks?status=todo | jq
curl -X POST -H "Authorization: Bearer sk-agent-local-2026" -H "Content-Type: application/json" -d '{"perencanaanId":"f2a87..."}' http://localhost:5173/api/agent/tasks
curl -X PATCH -H "Authorization: Bearer sk-agent-local-2026" -H "Content-Type: application/json" -d '{"id":"<taskId>","status":"done"}' http://localhost:5173/api/agent/tasks
```

## Publish (owner)
```bash
cd cli && npm publish --access public
# user tinggal: npx menglabs-ngoding@latest sync
```
