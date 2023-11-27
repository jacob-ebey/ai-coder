import * as fs from "node:fs/promises";
import * as path from "node:path";

import cq from "concurrent-queue";
import { OpenAI } from "openai";
import { LocalIndex } from "vectra";

const workdir = path.resolve("model/lucid-react");

const index = new LocalIndex(path.join(workdir, "index"));

const icons = JSON.parse(
  await fs.readFile(path.join(workdir, "icons.json"), "utf8")
);

const openai = new OpenAI();

if (!(await index.isIndexCreated())) {
  await index.createIndex();
}

const embedQueue = cq()
  .limit({ concurrency: 20 })
  .process(async (icon) => {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: icon,
    });
    const vector = response?.data?.[0]?.embedding;
    if (!vector) {
      throw new Error("Could not generate embedding.");
    }

    await index.insertItem({
      vector,
      metadata: { icon },
    });
  });

const promises = icons.map((icon) => embedQueue(icon));
Promise.all(promises).catch(() => {
  // Ignore errors.
});

let i = 0;
for (const promise of promises) {
  await promise;
  console.log(`Embedded ${++i} of ${promises.length}`);
}
