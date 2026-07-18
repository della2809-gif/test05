import { execFileSync } from "node:child_process";

if (!process.env.CI && !process.env.VERCEL) {
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], { stdio: "inherit" });
  console.log("Git secret-protection hooks enabled.");
}