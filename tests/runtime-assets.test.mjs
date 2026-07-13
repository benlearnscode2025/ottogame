import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceFiles = ["index.html", "src/game.js"];
const assetPattern = /(?:\.\/)?assets\/[A-Za-z0-9._/-]+/g;
const references = new Set();

for (const sourceFile of sourceFiles) {
  const source = readFileSync(path.join(root, sourceFile), "utf8");
  for (const match of source.matchAll(assetPattern)) {
    references.add(match[0].replace(/^\.\//, ""));
  }
}

const vercelPatterns = readFileSync(path.join(root, ".vercelignore"), "utf8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#") && !line.startsWith("!"));

function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp("^" + escaped.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*").replace(/\?/g, "[^/]") + "$");
}

function isVercelIgnored(reference) {
  const normalized = reference.replaceAll("\\", "/");
  return vercelPatterns.some((rawPattern) => {
    const pattern = rawPattern.replaceAll("\\", "/");
    if (pattern.endsWith("/")) {
      return normalized.startsWith(pattern.replace(/^\//, ""));
    }
    if (!pattern.includes("/")) {
      return globToRegExp(pattern).test(path.posix.basename(normalized));
    }
    return globToRegExp(pattern.replace(/^\//, "")).test(normalized);
  });
}

const failures = [];
for (const reference of [...references].sort()) {
  if (!existsSync(path.join(root, reference))) {
    failures.push(`${reference}: missing locally`);
    continue;
  }

  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", reference], {
      cwd: root,
      stdio: "ignore",
    });
  } catch {
    failures.push(`${reference}: not tracked by Git`);
  }

  if (isVercelIgnored(reference)) {
    failures.push(`${reference}: excluded by .vercelignore`);
  }
}

if (failures.length) {
  console.error("Runtime asset verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Runtime asset verification passed: ${references.size} referenced assets are tracked and deployable.`);
