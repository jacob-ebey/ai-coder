#!/usr/bin/env node

import("../lib/ai-coder.js")
  .then(({ cli }) => cli(process.argv.slice(2)))
  .catch((reason) => {
    console.error(reason.message);
    if (process.env.DEBUG) {
      console.error(reason);
    }

    process.exit(1);
  });
