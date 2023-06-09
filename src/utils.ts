import fs from "node:fs";
import path from "node:path";

export async function* walkDir(dir: string): AsyncGenerator<string, void, unknown> {
  for await (const d of await fs.promises.opendir(dir)) {
    const entry = path.join(dir, d.name);
    if (d.isDirectory()) yield* walkDir(entry);
    else if (d.isFile()) yield entry;
  }
}
