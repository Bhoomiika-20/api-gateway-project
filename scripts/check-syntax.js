const { execFileSync } = require("child_process");
const { readdirSync, statSync } = require("fs");
const { join } = require("path");

const roots = ["gateway", "services", "__tests__"];

function findJavaScriptFiles(directory) {
  const entries = readdirSync(directory);
  const files = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...findJavaScriptFiles(fullPath));
    } else if (entry.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
}

const files = roots.flatMap(findJavaScriptFiles);

for (const file of files) {
  execFileSync(process.execPath, ["--check", file], {
    stdio: "inherit"
  });
}

console.log(`Syntax check passed for ${files.length} JavaScript files.`);
