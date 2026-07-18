import { execFileSync } from "node:child_process";

const rules = [
  { name: "OpenAI API key", pattern: new RegExp("s" + "k-[A-Za-z0-9_-]{20,}", "g") },
  { name: "Supabase secret key", pattern: new RegExp("sb_" + "secret_[A-Za-z0-9_-]{20,}", "g") },
  { name: "GitHub token", pattern: new RegExp("gh" + "[ps]_[A-Za-z0-9]{30,}", "g") },
];

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
}

const [mode = "--history", value] = process.argv.slice(2);
let content;

if (mode === "--history") {
  content = git(["log", "--all", "-p", "--format="]);
} else if (mode === "--staged") {
  content = git(["diff", "--cached", "--no-ext-diff", "--unified=0"]);
} else if (mode === "--range" && value) {
  content = git(["log", "-p", "--format=", value]);
} else {
  console.error("Usage: node scripts/check-secrets.mjs --history|--staged|--range <revision-range>");
  process.exit(2);
}

const findings = rules
  .map(({ name, pattern }) => ({ name, count: content.match(pattern)?.length ?? 0 }))
  .filter(({ count }) => count > 0);

if (findings.length > 0) {
  console.error("Push blocked: credential-like values were found.");
  for (const finding of findings) console.error(`- ${finding.name}: ${finding.count}`);
  console.error("Move secrets to environment variables and remove them from every affected commit.");
  process.exit(1);
}

console.log("Secret scan passed.");