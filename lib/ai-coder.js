import arg from "arg";

import { commit } from "./commit.js";
import { pr } from "./pr.js";
import { remixRoute } from "./remix-route.js";

export async function cli(argv) {
  const args = arg(
    {
      "--help": Boolean,
    },
    {
      argv,
    }
  );

  const [command] = args._;

  if (!command || args["--help"]) {
    console.log(`
Usage
  $ ai-coder <command>

Commands
  commit       Commit staged changes with an AI generated commit message
  pr           Generate a pull request with an AI generated title and body
  remix-route  Generate a remix route with an AI generated explanation

Arguments
  --help  Display help
  `);
    return;
  }

  switch (command) {
    case "commit":
      await commit();
      break;
    case "pr":
      await pr();
      break;
    case "remix-route":
      await remixRoute();
      break;
    default:
      throw new Error(`"${command}" is not a valid command.`);
  }
}
