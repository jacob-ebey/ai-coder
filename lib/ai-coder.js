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
        help  Display help
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
    default:
      throw new Error(`"${command}" is not a valid command.`);
  }
}
