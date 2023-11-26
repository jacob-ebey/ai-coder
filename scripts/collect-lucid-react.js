import * as fs from "node:fs/promises";
import * as path from "node:path";

import * as lexer from "es-module-lexer";

const workdir = path.resolve("model/lucid-react");
await fs.mkdir(workdir, { recursive: true });

const code = await fetch(
  "https://esm.sh/v135/lucide-react@0.293.0/es2022/lucide-react.mjs"
).then((response) => response.text());

const [, theExports] = lexer.parse(code);
const iconImports = theExports.map((e) => code.slice(e.s, e.e));

await fs.writeFile(
  path.join(workdir, "icons.json"),
  JSON.stringify(iconImports, null, 2),
  "utf8"
);
