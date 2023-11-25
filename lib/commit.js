import * as fsp from "node:fs/promises";

import enquirer from "enquirer";
import { execa } from "execa";
import { OpenAI } from "openai";

const { prompt } = enquirer;

export async function commit() {
  const [diff, commitCount, pkgJson] = await Promise.all([
    getDiffExcludes().then((excludes) =>
      execa("git", ["--no-pager", "diff", "--staged", "--", ".", ...excludes])
    ),
    execa("git", ["rev-list", "--count", "--all"]),
    getPackageJson(),
  ]);

  const openai = new OpenAI();

  /** @type {OpenAI.Chat.Completions.ChatCompletionMessageParam[]} */
  const messages = [
    {
      role: "system",
      content:
        "Your task is to write a commite message for the current working repository acording to the staged changes. " +
        "The commit message should be in the conventional commit format. " +
        "The conventional commit message should be no longer than 72 characters. " +
        "The conventional commit message can be followed by a longer description if needed. " +
        "If more context is needed you can ask a question to the user instead of generating a commit message.",
    },
    {
      role: "user",
      content:
        `Contextual Information:\n\n` +
        `Commit Count: ${commitCount.stdout}\n\n` +
        (pkgJson?.name ? `Project name: ${pkgJson.name}` : "") +
        (pkgJson?.description
          ? `Project description: ${pkgJson.description}`
          : "") +
        `\`git diff --staged\` output:\n` +
        "```\n" +
        diff.stdout +
        "\n```",
    },
    {
      role: "user",
      content: "Generate a commit message",
    },
  ];

  async function generateCommitMessage() {
    let aiResponse = "";
    const functionCalls = [];

    process.stdout.write("generating commit message...");
    const completion = await openai.chat.completions.create({
      model: "gpt-4-1106-preview",
      stream: true,
      messages,
      tool_choice: "auto",
      tools: [
        {
          type: "function",
          function: {
            name: "commit-message",
            description: "Generate a commit message",
            parameters: {
              type: "object",
              properties: {
                "commit-message": {
                  type: "string",
                  description: "The commit message",
                },
              },
            },
          },
        },
      ],
    });

    for await (const chunk of completion) {
      for (const choice of chunk.choices) {
        if (choice.delta.content) {
          if (!aiResponse) {
            process.stdout.write("\n");
          }
          process.stdout.write(choice.delta.content);
          aiResponse += choice.delta.content;
        }

        if (choice.delta.tool_calls?.length) {
          for (const toolCall of choice.delta.tool_calls) {
            if (!functionCalls[toolCall.index]) {
              functionCalls[toolCall.index] = toolCall;
              functionCalls[toolCall.index].function =
                functionCalls[toolCall.index].function || {};
              functionCalls[toolCall.index].function.arguments =
                functionCalls[toolCall.index].function.arguments || "";
            } else {
              process.stdout.write(".");
              functionCalls[toolCall.index].function.arguments +=
                toolCall.function.arguments;
            }
          }
        }
      }
    }
    process.stdout.write("\n");

    for (const functionCall of functionCalls) {
      if (functionCall.function.name === "commit-message") {
        return {
          aiResponse: "",
          commitMessage: JSON.parse(functionCall.function.arguments)[
            "commit-message"
          ],
        };
      }
    }

    return {
      aiResponse,
      commitMessage,
    };
  }

  const { aiResponse, commitMessage } = await generateCommitMessage();

  if (commitMessage) {
    const answer = await prompt({
      type: "confirm",
      name: "confirm",
      message: `Would you like to commit with this message?\n${commitMessage}`,
    });

    if (answer?.confirm) {
      await commitInteractiveWithInitialMessage(commitMessage);
      return;
    }
  }

  if (aiResponse) {
    const answer = await prompt({
      type: "input",
      name: "response",
      message: "Response:",
    });
    if (answer?.response) {
      messages.push(
        {
          role: "assistant",
          content: aiResponse,
        },
        {
          role: "user",
          content: answer.response,
        }
      );
      const { aiResponse, commitMessage } = await generateCommitMessage();

      if (commitMessage) {
        const answer = await prompt({
          type: "confirm",
          name: "confirm",
          message: `Would you like to commit with this message?\n${commitMessage}`,
        });

        if (answer?.confirm) {
          await commitInteractiveWithInitialMessage(commitMessage);
          return;
        }
      }
    }
  }

  throw new Error("No commit message generated.");
}

async function commitInteractiveWithInitialMessage(message) {
  const res = await execa("git", ["commit", "-m", message], {
    stdio: "inherit",
  });
  if (res.exitCode !== 0) {
    throw new Error("git commit failed");
  }
}

async function getDiffExcludes() {
  const contents = await fsp.readFile(".gitignore", "utf8");
  const lines = contents.split("\n");
  lines.push("pnpm-lock.yaml", "yarn.lock", "package-lock.json");

  const excludes = [];
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;
    if (line.startsWith("!")) {
      excludes.push(`:(include)${line.slice(1)}`);
    }

    excludes.push(`:(exclude)${line}`);
  }

  return excludes;
}

async function getPackageJson() {
  try {
    const contents = await fsp.readFile("package.json", "utf8");
    return JSON.parse(contents);
  } catch {
    return null;
  }
}
