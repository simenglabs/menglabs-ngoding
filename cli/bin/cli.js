#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { spawn } from "child_process";
import crypto from "crypto";
import { loadConfig, saveConfig } from "../lib/config.js";
import {
  listTasks,
  claimNext,
  setStatus,
  listPerencanaan,
  apiFetch,
} from "../lib/api.js";
import { interpolate, splitCommand } from "../lib/command.js";

const program = new Command();

function runExecutable([executable, ...rawArgs], task) {
  const args = rawArgs.map((arg) => interpolate(arg, task));
  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        TASK_ID: task.id,
        TASK_TITLE: task.title,
        TASK_DESC: task.description || "",
        TASK_JSON: JSON.stringify(task),
      },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      stdout = (stdout + chunk).slice(-8000);
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      stderr = (stderr + chunk).slice(-8000);
    });
    child.on("close", (code) =>
      resolve({ exitCode: code ?? 1, stdout, stderr }),
    );
    child.on("error", (error) =>
      resolve({
        exitCode: 1,
        stdout,
        stderr: `${stderr}\n${error.message}`.trim(),
      }),
    );
  });
}

const agentCommands = {
  claude:
    'claude -p --permission-mode auto "Gunakan konteks proyek dan PRD berikut untuk mengerjakan task ini sampai tuntas di repository saat ini. Jalankan pemeriksaan yang relevan sebelum selesai.\n\n{{context}}"',
  antigravity: 'antigravity run --task "{{title}}"',
  cursor: 'cursor-agent "{{title}}"',
};

async function runWorker(
  opts,
  { stopWhenEmpty = false, stopOnFailure = false } = {},
) {
  const execTpl =
    opts.exec || (opts.agent ? agentCommands[opts.agent] || opts.agent : "");
  if (!execTpl) {
    console.log(chalk.yellow("Butuh --exec atau --agent. Contoh:"));
    console.log(
      chalk.dim(
        "  npx menglabs-ngoding run --exec \"claude -p 'kerjakan {{title}}: {{description}}'\"",
      ),
    );
    return;
  }
  const poll = Math.max(Number(opts.poll) || 4, 1);
  let execArgs;
  let verifyArgs;
  try {
    execArgs = splitCommand(execTpl);
    verifyArgs = opts.verify ? splitCommand(opts.verify) : null;
  } catch (error) {
    console.error(chalk.red(error.message));
    process.exitCode = 2;
    return;
  }
  const workerId = `cli-${crypto.randomUUID()}`;
  console.log(
    chalk.bold(`[run] agent worker aktif`),
    chalk.dim(`poll ${poll}s`),
  );
  let completed = 0;
  while (true) {
    let claimed;
    let claimToken;
    try {
      const r = await claimNext(opts.perencanaan, {
        claim: !opts.dry,
        workerId,
      });
      claimed = r.task;
      claimToken = r.claimToken;
    } catch (e) {
      console.error(chalk.red("[claim error]"), e.message);
      if (opts.once || stopWhenEmpty) {
        process.exitCode = 1;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, poll * 1000));
      continue;
    }
    if (!claimed) {
      if (stopWhenEmpty)
        console.log(
          chalk.green(`[selesai] ${completed} task dikerjakan; antrean kosong`),
        );
      else console.log(chalk.dim("[idle] tidak ada todo, tunggu..."));
      if (opts.once || stopWhenEmpty) break;
      await new Promise((resolve) => setTimeout(resolve, poll * 1000));
      continue;
    }
    console.log(
      chalk.green(
        `[claimed] ${claimed.id.slice(0, 8)} ${claimed.title} → doing`,
      ),
    );
    const [executable, ...rawArgs] = execArgs;
    const args = rawArgs.map((arg) => interpolate(arg, claimed));
    const preview = args
      .map((arg) =>
        JSON.stringify(arg.length > 180 ? `${arg.slice(0, 180)}…` : arg),
      )
      .join(" ");
    console.log(chalk.cyan(`[exec] ${executable} ${preview}`));
    if (opts.dry) {
      console.log(chalk.dim("[dry] skip exec; zero mutation"));
      break;
    }
    const executionPromise = runExecutable(execArgs, claimed);
    const execution = await new Promise((resolve) => {
      const heartbeat = setInterval(
        () => {
          setStatus(claimed.id, "doing", { claimToken }).catch((error) =>
            console.error(chalk.yellow("[heartbeat error]"), error.message),
          );
        },
        5 * 60 * 1000,
      );
      executionPromise.then((value) => {
        clearInterval(heartbeat);
        resolve(value);
      });
    });
    const verification =
      execution.exitCode === 0 && verifyArgs
        ? await runExecutable(verifyArgs, claimed)
        : null;
    const ok =
      execution.exitCode === 0 &&
      (!verification || verification.exitCode === 0);
    const result = {
      summary: ok ? "command selesai" : "command atau verifikasi gagal",
      execution: {
        exitCode: execution.exitCode,
        stdout: execution.stdout,
        stderr: execution.stderr,
      },
      verification: verification
        ? {
            status: verification.exitCode === 0 ? "passed" : "failed",
            exitCode: verification.exitCode,
            stdout: verification.stdout,
            stderr: verification.stderr,
          }
        : { status: "not_run" },
      completedAt: new Date().toISOString(),
    };
    try {
      await setStatus(claimed.id, ok ? "done" : "todo", {
        claimToken,
        result,
      });
      if (ok) {
        completed += 1;
        console.log(chalk.green(`[done] ${claimed.id.slice(0, 8)} → done`));
      } else console.log(chalk.yellow("[fail] kembalikan ke todo"));
    } catch (error) {
      console.error(
        chalk.red("[status error] pekerjaan tidak dijalankan ulang otomatis:"),
        error.message,
      );
      process.exitCode = 1;
      break;
    }
    if (!ok && stopOnFailure) {
      process.exitCode = 1;
      break;
    }
    if (opts.once) break;
  }
}
program
  .name("menglabs-ngoding")
  .description(
    "Menglabs Ngoding — sync hosted platform ↔ local, bebas pakai agent CLI (claude, antigravity, cursor)",
  )
  .version("0.1.0");

// init
program
  .command("init")
  .description("Setup koneksi ke platform hosted")
  .option(
    "--url <url>",
    "API base, mis http://localhost:5173 atau https://ngoding.menglabs.id",
  )
  .option("--key <key>", "AGENT_API_KEY")
  .option("--perencanaan <id>", "perencanaanId default")
  .option("--global", "simpan ke ~/.menglabs/config.json")
  .action((opts) => {
    const patch = {};
    if (opts.url) patch.apiBase = opts.url;
    if (opts.key) patch.apiKey = opts.key;
    if (opts.perencanaan) patch.perencanaanId = opts.perencanaan;
    const file = saveConfig(patch, { global: !!opts.global });
    const c = loadConfig();
    console.log(chalk.green("✓ config saved →"), file);
    console.log(
      chalk.dim(
        JSON.stringify(
          { apiBase: c.apiBase, perencanaanId: c.perencanaanId || "(belum)" },
          null,
          2,
        ),
      ),
    );
    console.log(
      chalk.dim(
        "Tips: export MENGLABS_API / MENGLABS_KEY juga bisa, atau pakai --url/--key per command",
      ),
    );
  });

// config
program
  .command("config")
  .description("Lihat config aktif")
  .action(() => {
    const c = loadConfig();
    console.log(
      JSON.stringify(
        {
          apiBase: c.apiBase,
          apiKey: c.apiKey ? c.apiKey.slice(0, 12) + "..." : "",
          perencanaanId: c.perencanaanId,
          file: c._file,
        },
        null,
        2,
      ),
    );
  });

// list
program
  .command("tasks")
  .alias("list")
  .description("Lihat tasks dari kanban")
  .option("--status <s>", "todo|doing|done|backlog", "todo")
  .option("--perencanaan <id>", "filter perencanaan")
  .option("--limit <n>", "limit", "20")
  .option("--json", "output json")
  .action(async (opts) => {
    const d = await listTasks({
      status: opts.status,
      perencanaanId: opts.perencanaan,
      limit: Number(opts.limit),
    });
    if (opts.json) {
      console.log(JSON.stringify(d, null, 2));
      return;
    }
    const tasks = d.tasks || [];
    if (!tasks.length) {
      console.log(chalk.yellow(`Tidak ada tasks status=${opts.status}`));
      return;
    }
    console.log(chalk.bold(`\n${tasks.length} tasks [${opts.status}]`));
    for (const t of tasks) {
      const p =
        t.priority === "high"
          ? chalk.red("high")
          : t.priority === "medium"
            ? chalk.yellow("med")
            : chalk.green("low");
      console.log(
        `${chalk.dim(t.id.slice(0, 8))} ${chalk.bold(t.title)} ${chalk.dim(`[${p} ${t.estimate}]`)} ${chalk.cyan(t.subFiturTitle || "")}`,
      );
      if (t.description)
        console.log(chalk.dim(`  ${t.description.slice(0, 90)}`));
    }
    console.log(
      chalk.dim(
        `\nAPI: ${loadConfig().apiBase} · perencanaan: ${opts.perencanaan || loadConfig().perencanaanId || "all"}`,
      ),
    );
  });

// claim
program
  .command("claim")
  .description("Claim 1 todo terlama → jadi doing (otomatis)")
  .option("--perencanaan <id>")
  .action(async (opts) => {
    const r = await claimNext(opts.perencanaan);
    if (!r.task) {
      console.log(chalk.yellow("Tidak ada todo"));
      return;
    }
    console.log(chalk.green("✓ claimed → doing"));
    console.log(
      JSON.stringify(
        {
          task: r.task,
          claimToken: r.claimToken,
          leaseExpiresAt: r.leaseExpiresAt,
        },
        null,
        2,
      ),
    );
    console.log(
      chalk.dim(
        "Next: kerjakan task, lalu npx menglabs-ngoding done <id> --claim-token <claimToken>",
      ),
    );
  });

// done / doing
program
  .command("done <id>")
  .description("Set task jadi done")
  .requiredOption("--claim-token <token>", "claim token dari command claim")
  .action(async (id, opts) => {
    const r = await setStatus(id, "done", { claimToken: opts.claimToken });
    console.log(chalk.green(`✓ ${id.slice(0, 8)} → done`), r.id);
  });
program
  .command("doing <id>")
  .description("Perpanjang status doing")
  .requiredOption("--claim-token <token>")
  .action(async (id, opts) => {
    const r = await setStatus(id, "doing", { claimToken: opts.claimToken });
    console.log(chalk.yellow(`→ ${id.slice(0, 8)} doing`), r.id);
  });
program
  .command("todo <id>")
  .description("Kembalikan ke todo")
  .requiredOption("--claim-token <token>")
  .action(async (id, opts) => {
    await setStatus(id, "todo", { claimToken: opts.claimToken });
    console.log(chalk.dim(`↩ ${id.slice(0, 8)} → todo`));
  });

// perencanaan list
program
  .command("perencanaan")
  .description("List perencanaan dari DB")
  .option("--json")
  .action(async (opts) => {
    const d = await listPerencanaan();
    if (opts.json) {
      console.log(JSON.stringify(d, null, 2));
      return;
    }
    for (const p of d)
      console.log(
        `${chalk.dim(p.id.slice(0, 8))} ${chalk.bold(p.title)}${p.fiturCount == null ? "" : ` ${chalk.dim(`${p.fiturCount} fitur · ${p.taskCount} tasks`)}`}`,
      );
  });

// run — sync + bebas pakai agent CLI apapun
program
  .command("run")
  .description("Poll todo → jalankan executable tanpa shell per task")
  .option("--perencanaan <id>")
  .option(
    "--exec <cmd>",
    "executable dan argumen; placeholder diperlakukan sebagai data literal",
    "",
  )
  .option("--agent <name>", "alias: claude|antigravity|cursor|opencode", "")
  .option(
    "--verify <cmd>",
    "command verifikasi setelah command utama sukses",
    "",
  )
  .option("--once", "hanya 1 siklus lalu exit")
  .option("--poll <sec>", "interval detik", "4")
  .option("--dry", "hanya baca dan tampilkan; tidak claim atau mengubah status")
  .action((opts) => runWorker(opts));

program
  .command("autopilot")
  .description("Ambil PRD dan kerjakan seluruh todo proyek dengan Claude")
  .requiredOption("--url <url>", "URL platform")
  .requiredOption("--key <token>", "project token")
  .requiredOption("--perencanaan <id>", "ID proyek")
  .option("--exec <cmd>", "override executable untuk agent lain atau testing")
  .option("--verify <cmd>", "command verifikasi setelah setiap task")
  .option("--poll <sec>", "interval detik", "4")
  .action(async (opts) => {
    process.env.MENGLABS_API = opts.url;
    process.env.MENGLABS_KEY = opts.key;
    process.env.MENGLABS_PERENCANAAN = opts.perencanaan;
    console.log(chalk.bold("[autopilot] ambil PRD dan semua task proyek"));
    await runWorker(
      {
        ...opts,
        agent: opts.exec ? "" : "claude",
      },
      { stopWhenEmpty: true, stopOnFailure: true },
    );
  });

// quick sync info
program
  .command("sync")
  .description("Info sync hosted ↔ local")
  .action(async () => {
    const c = loadConfig();
    console.log(chalk.bold("Sync info"));
    console.log(`API base: ${chalk.cyan(c.apiBase)}`);
    console.log(`Perencanaan: ${chalk.cyan(c.perencanaanId || "(all)")}`);
    try {
      const d = await apiFetch("/api/perencanaan");
      console.log(chalk.dim(`${d.length} perencanaan di hosted`));
      const t = await listTasks({ status: "todo", limit: 3 });
      console.log(chalk.dim(`${t.count} todo tasks`));
    } catch (e) {
      console.error(
        chalk.red("fetch fail"),
        e.message,
        chalk.dim("cek --url / --key atau init"),
      );
    }
  });

program.parse();
