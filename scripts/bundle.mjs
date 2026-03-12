import { build } from "esbuild";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

await build({
  entryPoints: [resolve(root, "apps/cli/dist/index.js")],
  bundle: true,
  platform: "node",
  target: "node22",
  outfile: resolve(root, "bin/agents-vault.js"),
  format: "cjs",
  // shebang is already in the source entry point
  // These are native Node.js modules — don't bundle them
  external: [
    "better-sqlite3",
    "fsevents",
  ],
});

console.log("Bundled → bin/agents-vault.js");
