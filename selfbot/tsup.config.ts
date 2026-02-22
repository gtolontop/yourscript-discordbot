import { defineConfig } from "tsup";
import { readdirSync, statSync } from "fs";
import { join } from "path";

function getEntryPoints(dir: string, base = ""): string[] {
  const entries: string[] = [];
  const items = readdirSync(dir);

  for (const item of items) {
    const fullPath = join(dir, item);
    const relativePath = base ? `${base}/${item}` : item;

    if (statSync(fullPath).isDirectory()) {
      entries.push(...getEntryPoints(fullPath, relativePath));
    } else if (item.endsWith(".ts") && !item.endsWith(".d.ts")) {
      entries.push(`src/${relativePath}`);
    }
  }

  return entries;
}

export default defineConfig({
  entry: getEntryPoints("src"),
  format: ["esm"],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: "es2022",
  outDir: "dist",
  bundle: false,
});
