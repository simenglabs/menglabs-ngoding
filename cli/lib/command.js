export function splitCommand(input) {
  const args = [];
  let current = "";
  let quote = null;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quote) {
      if (char === quote) quote = null;
      else if (char === "\\" && quote === '"' && i + 1 < input.length)
        current += input[++i];
      else current += char;
    } else if (char === '"' || char === "'") quote = char;
    else if (/\s/.test(char)) {
      if (current) {
        args.push(current);
        current = "";
      }
    } else current += char;
  }
  if (quote) throw new Error("quote tidak ditutup pada --exec");
  if (current) args.push(current);
  if (!args.length) throw new Error("--exec kosong");
  return args;
}

export function interpolate(value, task) {
  return value
    .replaceAll("{{title}}", task.title)
    .replaceAll("{{description}}", task.description || "")
    .replaceAll("{{id}}", task.id)
    .replaceAll("{{fitur}}", task.fiturTitle || "")
    .replaceAll("{{subFitur}}", task.subFiturTitle || "")
    .replaceAll("{{prd}}", task.prdContent || "")
    .replaceAll("{{context}}", JSON.stringify(task));
}
