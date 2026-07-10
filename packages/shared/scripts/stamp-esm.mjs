// tsc emits plain `.js` into dist/esm. Without this marker Node — and any
// bundler that consults the nearest package.json — would read those files as
// CommonJS and the named exports would vanish behind an interop wrapper.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const esmDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "esm");
writeFileSync(join(esmDir, "package.json"), `${JSON.stringify({ type: "module" }, null, 2)}\n`);
