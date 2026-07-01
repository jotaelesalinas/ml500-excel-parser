import { readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { execFileSync } from "node:child_process";

function collectFiles(rootDir) {
  const files = [];
  const entries = readdirSync(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }

    const extension = extname(entry.name);
    if (extension === ".js" || extension === ".mjs") {
      files.push(fullPath);
    }
  }

  return files;
}

const roots = ["src", "spec", "app.js"].filter((entry) => {
  try {
    return statSync(entry).isFile() || statSync(entry).isDirectory();
  } catch {
    return false;
  }
});

const files = [];
for (const root of roots) {
  if (statSync(root).isDirectory()) {
    files.push(...collectFiles(root));
  } else {
    files.push(root);
  }
}

files.sort();

for (const file of files) {
  execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
}

console.log(`Checked ${files.length} JavaScript files.`);
