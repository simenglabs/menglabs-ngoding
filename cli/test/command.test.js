import test from "node:test";
import assert from "node:assert/strict";
import { interpolate, splitCommand } from "../lib/command.js";

test("parses quoted arguments without invoking a shell", () => {
  assert.deepEqual(splitCommand(`agent --prompt "hello world"`), [
    "agent",
    "--prompt",
    "hello world",
  ]);
});

test("interpolation preserves shell syntax as literal task data", () => {
  assert.equal(
    interpolate("{{title}}", {
      id: "1",
      title: "$(touch /tmp/never)",
      description: "",
    }),
    "$(touch /tmp/never)",
  );
});

test("interpolation includes PRD and full task context", () => {
  const task = {
    id: "task-1",
    title: "Login",
    description: "Implement login",
    prdContent: "# PRD\n\nAcceptance criteria",
  };
  assert.equal(interpolate("{{prd}}", task), task.prdContent);
  assert.deepEqual(JSON.parse(interpolate("{{context}}", task)), task);
});

test("rejects unclosed quotes", () => {
  assert.throws(() => splitCommand(`agent "broken`), /quote tidak ditutup/);
});
