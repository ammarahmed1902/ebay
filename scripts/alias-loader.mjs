import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const srcRoot = fileURLToPath(new URL("../src/", import.meta.url));

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "vitest") {
    return {
      shortCircuit: true,
      url: new URL("./vitest-shim.mjs", import.meta.url).href,
    };
  }

  if (specifier.startsWith("@/")) {
    const base = path.join(srcRoot, specifier.slice(2));
    const found = [base, `${base}.ts`, `${base}.tsx`, `${base}.json`].find((item) =>
      fs.existsSync(item),
    );
    if (!found) {
      throw new Error(`Cannot resolve ${specifier}`);
    }
    if (found.endsWith(".json")) {
      return {
        shortCircuit: true,
        format: "json",
        url: pathToFileURL(found).href,
      };
    }
    return nextResolve(pathToFileURL(found).href, context);
  }

  return nextResolve(specifier, context);
}
