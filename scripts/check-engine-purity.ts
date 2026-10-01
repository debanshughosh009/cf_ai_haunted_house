// Purity checker for src/engine
// Engine must be pure TypeScript with zero Cloudflare or external server imports.
import * as fs from "node:fs";
import * as path from "node:path";

const ENGINE_DIR = path.resolve(import.meta.dirname, "../src/engine");
const FORBIDDEN_PATTERNS = [
  /cloudflare:/i,
  /@cloudflare\//i,
  /\bagents\b/i,
  /\bai\b/i,
  /\bworkers-ai-provider\b/i,
  /@ai-sdk/i,
];

function checkDirectory(dir: string): boolean {
  let clean = true;
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      clean = checkDirectory(fullPath) && clean;
    } else if (file.endsWith(".ts")) {
      const content = fs.readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (/^\s*import\b/.test(line) || /^\s*export\b.*from\b/.test(line)) {
          for (const pattern of FORBIDDEN_PATTERNS) {
            if (pattern.test(line)) {
              console.error(
                `[PURITY VIOLATION] ${path.relative(process.cwd(), fullPath)}:${i + 1}: ${line.trim()}`
              );
              clean = false;
            }
          }
        }
      }
    }
  }

  return clean;
}

const isClean = checkDirectory(ENGINE_DIR);
if (!isClean) {
  console.error("❌ Purity check failed. src/engine contains restricted imports.");
  process.exit(1);
} else {
  console.log("✅ src/engine purity check passed.");
}
