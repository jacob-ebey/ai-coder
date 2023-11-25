import * as fsp from "node:fs/promises";

import enquirer from "enquirer";
import { execa } from "execa";
import { OpenAI } from "openai";

import { ChatManager } from "./chat-manager.js";

const { prompt } = enquirer;

export async function commit() {
  const [diff, commitCount, pkgJson] = await Promise.all([
    getDiffExcludes().then((excludes) =>
      execa("git", ["--no-pager", "diff", "--staged", "--", ".", ...excludes])
    ),
    execa("git", ["rev-list", "--count", "--all"]),
    getPackageJson(),
  ]);

  const chat = new ChatManager();
  chat.regiesterFunction(
    {
      name: "commitMessage",
      description: "Generate a commit message",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "The commit message",
          },
        },
      },
    },
    async ({ message }) => message
  );
  chat.addSystemMessages(
    "Your task is to write a commite message for the current working repository acording to the staged changes. " +
      "The commit message should be in the conventional commit format. " +
      "The conventional commit message should be no longer than 72 characters. " +
      "The conventional commit message can be followed by a longer description if needed. " +
      "If more context is needed you can ask a question to the user instead of generating a commit message."
  );

  const { aiResponse, commitMessage } = await processStream(
    await chat.sendMessages(
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
      "Generate a commit message"
    )
  );

  if (commitMessage) {
    const answer = await prompt({
      type: "confirm",
      name: "confirm",
      message: `Would you like to commit with this message?\n\n${commitMessage}`,
    });

    if (answer?.confirm) {
      await commitInteractiveWithInitialMessage(commitMessage);
      return;
    }
  }

  if (aiResponse) {
    chat.addAssistantMessages(aiResponse);

    const answer = await prompt({
      type: "input",
      name: "response",
      message: "Response:",
    });
    if (answer?.response) {
      const { aiResponse, commitMessage } = await processStream(
        await chat.sendMessages(answer.response)
      );

      if (commitMessage) {
        const answer = await prompt({
          type: "confirm",
          name: "confirm",
          message: `Would you like to commit with this message?\n\n${commitMessage}`,
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

async function processStream(stream) {
  let aiResponse = "";
  let commitMessage = "";
  for await (const chunk of stream) {
    if ("message" in chunk) {
      if (!aiResponse) {
        process.stdout.write("\n");
      }
      aiResponse += chunk.message;
      process.stdout.write(chunk.message);
    }

    if ("function" in chunk) {
      if (chunk.function === "commitMessage") {
        commitMessage = chunk.result;
      }
    }
  }

  return {
    aiResponse,
    commitMessage,
  };
}
