#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { loadConfig, saveConfig } from '../lib/config.js';
import { listTasks, claimNext, setStatus, listPerencanaan, apiFetch } from '../lib/api.js';

const program = new Command();
program.name('menglabs-ngoding').description('Menglabs Ngoding — sync hosted platform ↔ local, bebas pakai agent CLI (claude, antigravity, cursor)').version('0.1.0');

// init
program.command('init').description('Setup koneksi ke platform hosted').option('--url <url>', 'API base, mis http://localhost:5173 atau https://ngoding.menglabs.id').option('--key <key>', 'AGENT_API_KEY').option('--perencanaan <id>', 'perencanaanId default').option('--global', 'simpan ke ~/.menglabs/config.json').action((opts) => {
  const patch = {};
  if (opts.url) patch.apiBase = opts.url;
  if (opts.key) patch.apiKey = opts.key;
  if (opts.perencanaan) patch.perencanaanId = opts.perencanaan;
  const file = saveConfig(patch, { global: !!opts.global });
  const c = loadConfig();
  console.log(chalk.green('✓ config saved →'), file);
  console.log(chalk.dim(JSON.stringify({ apiBase: c.apiBase, perencanaanId: c.perencanaanId || '(belum)' }, null, 2)));
  console.log(chalk.dim('Tips: export MENGLABS_API / MENGLABS_KEY juga bisa, atau pakai --url/--key per command'));
});

// config
program.command('config').description('Lihat config aktif').action(() => {
  const c = loadConfig();
  console.log(JSON.stringify({ apiBase: c.apiBase, apiKey: c.apiKey ? c.apiKey.slice(0,12)+'...' : '', perencanaanId: c.perencanaanId, file: c._file }, null, 2));
});

// list
program.command('tasks').alias('list').description('Lihat tasks dari kanban').option('--status <s>', 'todo|doing|done|backlog', 'todo').option('--perencanaan <id>', 'filter perencanaan').option('--limit <n>', 'limit', '20').option('--json', 'output json').action(async (opts) => {
  const d = await listTasks({ status: opts.status, perencanaanId: opts.perencanaan, limit: Number(opts.limit) });
  if (opts.json) { console.log(JSON.stringify(d, null, 2)); return; }
  const tasks = d.tasks || [];
  if (!tasks.length) { console.log(chalk.yellow(`Tidak ada tasks status=${opts.status}`)); return; }
  console.log(chalk.bold(`\n${tasks.length} tasks [${opts.status}]`));
  for (const t of tasks) {
    const p = t.priority === 'high' ? chalk.red('high') : t.priority === 'medium' ? chalk.yellow('med') : chalk.green('low');
    console.log(`${chalk.dim(t.id.slice(0,8))} ${chalk.bold(t.title)} ${chalk.dim(`[${p} ${t.estimate}]`)} ${chalk.cyan(t.subFiturTitle || '')}`);
    if (t.description) console.log(chalk.dim(`  ${t.description.slice(0,90)}`));
  }
  console.log(chalk.dim(`\nAPI: ${loadConfig().apiBase} · perencanaan: ${opts.perencanaan || loadConfig().perencanaanId || 'all'}`));
});

// claim
program.command('claim').description('Claim 1 todo terlama → jadi doing (otomatis)').option('--perencanaan <id>').action(async (opts) => {
  const r = await claimNext(opts.perencanaan);
  if (!r.task) { console.log(chalk.yellow('Tidak ada todo')); return; }
  console.log(chalk.green('✓ claimed → doing'));
  console.log(JSON.stringify(r.task, null, 2));
  console.log(chalk.dim('Next: kerjakan task, lalu npx menglabs-ngoding done <id> atau npx menglabs-ngoding run --exec "your-agent-cli"'));
});

// done / doing
program.command('done <id>').description('Set task jadi done').action(async (id) => {
  const r = await setStatus(id, 'done'); console.log(chalk.green(`✓ ${id.slice(0,8)} → done`), r.id);
});
program.command('doing <id>').description('Set task jadi doing').action(async (id) => {
  const r = await setStatus(id, 'doing'); console.log(chalk.yellow(`→ ${id.slice(0,8)} doing`), r.id);
});
program.command('todo <id>').description('Kembalikan ke todo').action(async (id) => {
  await setStatus(id, 'todo'); console.log(chalk.dim(`↩ ${id.slice(0,8)} → todo`));
});

// perencanaan list
program.command('perencanaan').description('List perencanaan dari DB').option('--json').action(async (opts) => {
  const d = await listPerencanaan();
  if (opts.json) { console.log(JSON.stringify(d, null, 2)); return; }
  for (const p of d) console.log(`${chalk.dim(p.id.slice(0,8))} ${chalk.bold(p.title)} ${chalk.dim(`${p.fiturCount} fitur · ${p.taskCount} tasks`)}`);
});

// run — sync + bebas pakai agent CLI apapun
program.command('run').description('Poll todo → jalankan agent CLI kamu per task (bebas: claude, antigravity, cursor)').option('--perencanaan <id>').option('--exec <cmd>', 'command template, vars: {{title}} {{description}} {{id}} — contoh: "claude -p \"kerjakan {{title}}: {{description}}\""', '').option('--agent <name>', 'alias: claude|antigravity|cursor|opencode (akan dipakai sebagai exec)', '').option('--once', 'hanya 1 task lalu exit').option('--poll <sec>', 'interval detik', '4').option('--dry', 'tidak set status, hanya print').action(async (opts) => {
  const execTpl = opts.exec || (opts.agent ? ({ claude: 'npx @anthropic-ai/claude-code --task "{{title}}: {{description}}"', antigravity: 'antigravity run --task "{{title}}"', cursor: 'cursor-agent "{{title}}"' }[opts.agent] || opts.agent) : '');
  if (!execTpl) {
    console.log(chalk.yellow('Butuh --exec atau --agent. Contoh:'));
    console.log(chalk.dim('  npx menglabs-ngoding run --exec "claude -p \'kerjakan {{title}}: {{description}}\'"'));
    console.log(chalk.dim('  npx menglabs-ngoding run --agent antigravity --perencanaan <id>'));
    console.log(chalk.dim('  npx menglabs-ngoding run --exec "echo {{title}} > task.txt" --once'));
    return;
  }
  const poll = Number(opts.poll);
  console.log(chalk.bold(`[run] exec: ${execTpl}`), chalk.dim(`poll ${poll}s`));
  while (true) {
    let claimed;
    try { const r = await claimNext(opts.perencanaan); claimed = r.task; } catch (e) { console.error(chalk.red('[claim error]'), e.message); await new Promise(r=>setTimeout(r, poll*1000)); continue; }
    if (!claimed) { console.log(chalk.dim('[idle] tidak ada todo, tunggu...')); if (opts.once) break; await new Promise(r=>setTimeout(r, poll*1000)); continue; }
    console.log(chalk.green(`[claimed] ${claimed.id.slice(0,8)} ${claimed.title} → doing`));
    // build command
    const cmd = execTpl.replaceAll('{{title}}', claimed.title).replaceAll('{{description}}', claimed.description || '').replaceAll('{{id}}', claimed.id).replaceAll('{{fitur}}', claimed.fiturTitle || '').replaceAll('{{subFitur}}', claimed.subFiturTitle || '');
    console.log(chalk.cyan(`[exec] ${cmd}`));
    if (opts.dry) { console.log(chalk.dim('[dry] skip exec, kembalikan ke todo')); await setStatus(claimed.id, 'todo'); continue; }
    const ok = await new Promise((resolve) => {
      const child = spawn(cmd, { shell: true, stdio: 'inherit', env: { ...process.env, TASK_ID: claimed.id, TASK_TITLE: claimed.title, TASK_DESC: claimed.description || '', TASK_JSON: JSON.stringify(claimed) } });
      child.on('close', (code) => resolve(code === 0));
      child.on('error', () => resolve(false));
    });
    if (ok) { await setStatus(claimed.id, 'done'); console.log(chalk.green(`[done] ${claimed.id.slice(0,8)} → done`)); }
    else { await setStatus(claimed.id, 'todo'); console.log(chalk.yellow(`[fail] kembalikan ke todo`)); }
    if (opts.once) break;
  }
});

// quick sync info
program.command('sync').description('Info sync hosted ↔ local').action(async () => {
  const c = loadConfig();
  console.log(chalk.bold('Sync info'));
  console.log(`API base: ${chalk.cyan(c.apiBase)}`);
  console.log(`Perencanaan: ${chalk.cyan(c.perencanaanId || '(all)')}`);
  try {
    const d = await apiFetch('/api/perencanaan');
    console.log(chalk.dim(`${d.length} perencanaan di hosted`));
    const t = await listTasks({ status: 'todo', limit: 3 });
    console.log(chalk.dim(`${t.count} todo tasks`));
  } catch (e) { console.error(chalk.red('fetch fail'), e.message, chalk.dim('cek --url / --key atau init')); }
});

program.parse();
