#!/usr/bin/env node
// Local AI Agent (Node) — poll todo -> doing -> done auto
// Usage: AGENT_API_KEY=sk-agent-local-2026 node agent/local-agent.js --perencanaan f2a87ca7...
const API_BASE = process.env.API_BASE || 'http://localhost:5173';
const KEY = process.env.AGENT_API_KEY || 'sk-agent-local-2026';
const headers = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function api(method, path, body) {
  const r = await fetch(`${API_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) console.error(`[error] ${method} ${path} ${r.status}`, (await r.text()).slice(0,300));
  return r.json().catch(()=>({}));
}

async function loop(perencanaanId, once=false) {
  console.log(`[agent] ${API_BASE} perencanaan=${perencanaanId||'all'}`);
  while(true){
    const q = `?status=todo&limit=5${perencanaanId?`&perencanaanId=${perencanaanId}`:''}`;
    const {tasks=[]} = await api('GET', `/api/agent/tasks${q}`);
    console.log(`[poll] ${tasks.length} todo`);
    if(!tasks.length){ if(once) break; await new Promise(r=>setTimeout(r,4000)); continue; }
    const {task} = await api('POST','/api/agent/tasks', {perencanaanId});
    if(!task){ await new Promise(r=>setTimeout(r,2000)); continue; }
    console.log(`[claimed] ${task.id.slice(0,8)} ${task.title} -> doing`);
    // === ganti dengan agent kamu: panggil LLM, tulis file, run test ===
    await new Promise(r=>setTimeout(r,2000));
    await api('PATCH','/api/agent/tasks', {id: task.id, status: 'done'});
    console.log(`[done] ${task.id.slice(0,8)} -> done`);
    if(once) break;
  }
}
const arg = process.argv.find(a=>a.startsWith('--perencanaan='));
loop(arg?arg.split('=')[1]:null, process.argv.includes('--once'));
