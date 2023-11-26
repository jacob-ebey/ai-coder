import * as fsp from "node:fs/promises";

import { execa } from "execa";

export async function commitInteractiveWithInitialMessage(message) {
  const res = await execa("git", ["commit", "-m", message], {
    stdio: "inherit",
  });
  if (res.exitCode !== 0) {
    throw new Error("git commit failed");
  }
}

export async function getDiffExcludes() {
  const contents = await fsp.readFile(".gitignore", "utf8");
  const lines = contents.split("\n");
  lines.push("pnpm-lock.yaml", "yarn.lock", "package-lock.json");

  const excludes = [];
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;
    if (line.startsWith("!")) {
      excludes.push(`:(include)${line.slice(1)}`);
    }

    excludes.push(`:(exclude)${line}`);
  }

  return excludes;
}

export async function getActiveBranchName() {
  const { stdout } = await execa("git", ["branch", "--show-current"]);
  return stdout;
}

export async function getCommitsSince(baseBranch, branch) {
  const { stdout } = await execa("git", [
    "log",
    `${baseBranch}..${branch}`,
    "--no-color",
  ]);
  return stdout;
}

export async function pushBranch(branch) {
  const process = await execa("git", ["push", "-u", "origin", branch], {
    stdio: "inherit",
  });
  if (process.exitCode !== 0) {
    throw new Error("git push failed");
  }
}

export async function getPackageJson() {
  try {
    const contents = await fsp.readFile("package.json", "utf8");
    return JSON.parse(contents);
  } catch {
    return null;
  }
}
