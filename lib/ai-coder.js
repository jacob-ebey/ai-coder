import arg from "arg";

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
  commit  Commit staged changes with an AI generated commit message
  pr      Generate a pull request with an AI generated title and body

Arguments
  --help  Display help
  `);
    return;
  }

  switch (command) {
    case "commit":
      const { commit } = await import("./commit.js");
      await commit();
      break;
    case "pr":
      const { pr } = await import("./pr.js");
      await pr();
      break;
    default:
      throw new Error(`"${command}" is not a valid command.`);
  }
}
