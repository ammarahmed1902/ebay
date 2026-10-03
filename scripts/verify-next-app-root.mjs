import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const hasAppDir = fs.existsSync(path.join(root, "app"));
const hasSrcAppDir = fs.existsSync(path.join(root, "src", "app"));

if (hasAppDir || hasSrcAppDir) {
  process.exit(0);
}

console.error(
  [
    "Next.js could not find an app/ or src/app/ directory under the Vercel project root.",
    "",
    `Current build root: ${root}`,
    "",
    "Fix in Vercel:",
    "  Project Settings → General → Root Directory",
    "  Set it to the folder that contains BOTH package.json and src/app (for this repo, that is usually the repository root).",
    "",
    "Fix in Git:",
    "  Ensure src/app/page.tsx and the rest of src/ are committed and pushed to GitHub.",
    "  On github.com, open your repo and confirm you see src/app/page.tsx before redeploying.",
  ].join("\n"),
);
process.exit(1);
