# MengLabs Ngoding — Idea → PRD → Fitur → Task → Kanban Auto

> **Svelte 5 + SvelteKit 2 + Tailwind 4 + Drizzle ORM + Turso (libSQL) + LLM Omni (OpenAI-compatible) + npx CLI sync**

Platform untuk ubah ide jadi rencana yang bisa dipahami AI tools pilihanmu — dari prompt → pertanyaan klarifikasi (MCQ) → preferensi tech stack → perencanaan workflow n8n (geser card, garis bezier) → breakdown fitur → sub fitur → tasks auto masuk Kanban + DB Turso. Bebas pakai agent CLI lokal (Claude, Antigravity, Cursor, OpenCode) via `npx menglabs-ngoding`.

**Live:** `http://localhost:5173` dev · Turso `libsql://menglabs-ngoding-menglabs.aws-ap-northeast-1.turso.io`

---

## Arsitektur

```
[Mau bikin apa?] → [Preferensi teknologi] → [Beberapa pertanyaan (LLM MCQ)] → [Perencanaan n8n + drag] → [Sub Fitur → Task (LLM)] → [Kanban (todo/doing/done)] → DB Turso + npx CLI
```

- **Frontend:** Svelte 5 runes (`$state`, `$derived`, `$effect`), SvelteKit 2, Tailwind 4, Vite 8
- **Backend:** SvelteKit `+server.ts` API, Drizzle ORM, Turso libSQL, session cookie auth
- **LLM:** Omni `https://omni.menglabs.id/v1` model `antigravity/claude-opus-4-6-thinking` (OpenAI-compatible)
- **CLI:** `cli/` → npm package `menglabs-ngoding` → `npx menglabs-ngoding@latest`

---

## Fitur

| Area | Detail |
|------|--------|
| **Landing** | `GET /` hero, fitur, mock workflow, recent projects dari Turso |
| **Create Flow** | `GET /create` → `POST /api/plan` → `POST /api/tasks` → `kanban_task` |
| **Clarify** | `POST /api/questions` → LLM MCQ 5 pertanyaan, `type=text|single|multi` |
| **Tech** | `BIARKAN AI PILIH` vs `PILIH SENDIRI` (Frontend/Backend/DB/Deploy) |
| **Workflow n8n** | Canvas dot grid, nodes `border-2 handle -right-7`, bezier `C` + arrow marker, drag `translate`, lines `getBoundingClientRect` dinamis, panel kanan Task List |
| **Kanban** | 4 kolom `backlog|todo|doing|done`, drag & drop `PATCH /api/kanban/[id]`, DB-backed jika `?perencanaanId=` |
| **Detail DB** | `GET /api/perencanaan`, `GET /api/perencanaan/[id]` full tree, `GET /api/kanban?perencanaanId` |
| **Implementasi** | `GET /implementasi` copy `npx` commands, API curl |
| **Auth** | `POST /api/auth/register|login|logout`, `GET /api/auth/me`, `hooks.server.ts` cookie `menglabs_session`, Turso `user` + `session`, perencanaan filter by `userId` |
| **Dashboard** | `GET /dashboard` recent projects, stats, link Kanban/Detail |
| **Agent Sync** | `GET/POST/PATCH /api/agent/tasks?status=todo` → `Authorization: Bearer AGENT_API_KEY`, claim atomik todo→doing→done, CLI `run --exec` bebas agent |

---

## Quick Start

```bash
# 1. Clone
git clone git@github-menglabs:simenglabs/menglabs-ngoding.git
cd menglabs-ngoding

# 2. Env
cp app/.env.example app/.env
# isi di app/.env:
# DATABASE_URL=libsql://menglabs-ngoding-menglabs.aws-ap-northeast-1.turso.io
# DATABASE_AUTH_TOKEN=eyJhbG...
# LLM_BASE_URL=https://omni.menglabs.id/v1
# LLM_API_KEY=sk-...
# AGENT_API_KEY=sk-agent-local-2026

# 3. Install & DB
cd app && npm install
npm run db:push          # drizzle-kit push → Turso
npm run dev -- --open    # http://localhost:5173

# 4. CLI (local)
cd ../cli && npm install && node bin/cli.js --help
npx /Volumes/.../cli tasks --limit 2   # atau setelah publish:
npx menglabs-ngoding@latest --help
```

---

## Turso (libSQL)

```bash
# app/drizzle.config.ts dialect:turso, url + authToken
# push schema
cd app && npm run db:push -- --force
# studio
npm run db:studio
# Tables: user, session, perencanaan (userId FK), fitur, sub_fitur, kanban_task, task, todo
```

`.env` sudah `DATABASE_URL` + `DATABASE_AUTH_TOKEN` Turso `aws-ap-northeast-1`.

---

## Auth

- `POST /api/auth/register` `{name,email,password}` → `201 + set-cookie menglabs_session`
- `POST /api/auth/login` `{email,password}` → `200 + cookie`
- `POST /api/auth/logout` → delete cookie
- `GET /api/auth/me` → `{user|null}`
- `GET /dashboard` & `GET /api/perencanaan` filter by `userId` jika login.

Pages: `GET /login`, `GET /register`, `GET /` (landing), `GET /dashboard` (menu utama).

---

## npx CLI — `menglabs-ngoding`

Package: `cli/package.json` → `name:menglabs-ngoding` `bin:menglabs-ngoding → ./bin/cli.js`

```bash
# sync hosted ↔ local
npx menglabs-ngoding@latest init --url https://ngoding.menglabs.id --key sk-agent-local-2026 --perencanaan <id> --global
npx menglabs-ngoding config
npx menglabs-ngoding sync

# tasks
npx menglabs-ngoding tasks --status todo --perencanaan <id>
npx menglabs-ngoding claim --perencanaan <id>   # claim 1 todo → doing
npx menglabs-ngoding done <taskId>              # doing → done
npx menglabs-ngoding perencanaan                # list perencanaan

# bebas pakai agent CLI kamu — auto poll todo→doing→done
npx menglabs-ngoding run --exec 'npx @anthropic-ai/claude-code -p "kerjakan {{title}}: {{description}}"' --perencanaan <id>
npx menglabs-ngoding run --agent antigravity --perencanaan <id>
npx menglabs-ngoding run --exec 'cursor-agent "{{title}}"' --once --dry

# env alt (tanpa file)
export MENGLABS_API=https://ngoding.menglabs.id
export MENGLABS_KEY=sk-agent-local-2026
export MENGLABS_PERENCANAAN=<id>
npx menglabs-ngoding tasks
```

Template vars: `{{title}} {{description}} {{id}} {{fitur}} {{subFitur}}` + env `TASK_ID/TASK_TITLE/TASK_DESC/TASK_JSON`

API langsung:
```bash
curl -H "Authorization: Bearer sk-agent-local-2026" "$API/api/agent/tasks?status=todo" | jq
curl -X POST -H "Authorization: Bearer sk-agent-local-2026" -d '{"perencanaanId":"<id>","claim":true}' $API/api/agent/tasks
curl -X PATCH -H "Authorization: Bearer sk-agent-local-2026" -d '{"id":"<taskId>","status":"done"}' $API/api/agent/tasks
```

Publish:
```bash
cd cli && npm version patch && npm publish --access public
# test
npx menglabs-ngoding@latest --help
```

Local dev tanpa publish: `npx /path/to/cli --help`

---

## Routes

| Route | Deskripsi |
|-------|-----------|
| `GET /` | Landing (hero, fitur, recent) |
| `GET /create` | Mau bikin apa? (prompt + referensi + bahasa) |
| `GET /preferensi` | Pilih tech (AI vs manual) |
| `GET /pertanyaan` | 5 MCQ dari LLM |
| `GET /perencanaan` | Workflow n8n, geser card, sub→task panel kanan |
| `GET /kanban?perencanaanId=` | Kanban 4 kolom DB |
| `GET /detail` | List perencanaan DB |
| `GET /detail/[id]` | Tree fitur→sub→tasks |
| `GET /implementasi` | Instruksi npx local |
| `GET /login` `GET /register` | Auth |
| `GET /dashboard` | Menu utama recent projects |

API: `POST /api/plan`, `POST /api/questions`, `POST /api/tasks`, `GET /api/perencanaan`, `GET /api/perencanaan/[id]`, `GET /api/kanban`, `PATCH /api/kanban/[id]`, `POST /api/auth/*`, `GET/POST/PATCH /api/agent/tasks`

---

## Env

```env
# app/.env
DATABASE_URL=libsql://menglabs-ngoding-menglabs.aws-ap-northeast-1.turso.io
DATABASE_AUTH_TOKEN=eyJhbGciOi...
LLM_BASE_URL=https://omni.menglabs.id/v1
LLM_API_KEY=sk-43ffab...
LLM_MODEL=antigravity/claude-opus-4-6-thinking
AGENT_API_KEY=sk-agent-local-2026
```

Set di hosting juga (Vercel/Cloudflare/Node env).

---

## Contribute

```bash
cd app && npm run check   # svelte-check 0 errors
cd app && npm run build   # vite build 124kB
cd cli && node bin/cli.js tasks --limit 2
```

Feedback: https://github.com/anomalyco/opencode · npx docs: `cli/README.md`

---

## License MIT
