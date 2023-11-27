import * as fs from "node:fs/promises";
import * as path from "node:path";

import cq from "concurrent-queue";
import { OpenAI } from "openai";
import { LocalIndex } from "vectra";

const workdir = path.resolve("model/chadcn-ui");

const index = new LocalIndex(path.join(workdir, "index"));

const metadata = JSON.parse(
  await fs.readFile(path.join(workdir, "metadata.json"), "utf8")
);

const openai = new OpenAI();

if (!(await index.isIndexCreated())) {
  await index.createIndex();
}

const embedQueue = cq()
  .limit({ concurrency: 20 })
  .process(async ({ name, component }) => {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input:
        `COMPONENT NAME: ${name}\n` +
        `COMPONENT DESCRIPTION: ${component.description}\n` +
        `IMPORT STATEMENT:\n\`\`\`ts\n${component.importStatement}\n\`\`\``,
    });
    const vector = response?.data?.[0]?.embedding;
    if (!vector) {
      throw new Error("Could not generate embedding.");
    }

    await index.insertItem({
      vector,
      metadata: { name },
    });
  });

const promises = Array.from(Object.entries(metadata.components)).map(
  ([name, component]) => embedQueue({ name, component })
);
Promise.all(promises).catch(() => {
  // Ignore errors.
});

let i = 0;
for (const promise of promises) {
  await promise;
  console.log(`Embedded ${++i} of ${promises.length}`);
}
