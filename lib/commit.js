import enquirer from "enquirer";
import { execa } from "execa";

import { ChatManager } from "./chat-manager.js";
import {
  commitInteractiveWithInitialMessage,
  getDiffExcludes,
  getPackageJson,
} from "./utils.js";

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
  chat.regiesterFunction(
    {
      name: "askQuestion",
      description: "Ask a follow up question to the user for more context",
      parameters: {
        type: "object",
        properties: {
          question: {
            type: "string",
            description: "The question to ask the user",
          },
        },
      },
    },
    ({ question }) => question
  );
  chat.addSystemMessages(
    "Your task is to write a commite message for the current working repository acording to the staged changes. " +
      "The commit message should be in the conventional commit format. " +
      "The conventional commit message should be no longer than 72 characters. " +
      "The conventional commit message can be followed by a longer description if needed. " +
      "Focus on feature changes, not code details. " +
      "If more context is needed to create a good message you can ask a question to the user. "
  );

  let { aiResponse, commitMessage } = await processStream(
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
        "\n```"
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

  while (aiResponse) {
    chat.addAssistantMessages(aiResponse);

    const answer = await prompt({
      type: "input",
      name: "response",
      message: aiResponse,
    });

    aiResponse = "";
    commitMessage = "";

    if (answer?.response) {
      const res = await processStream(
        await chat.sendMessages(answer.response, "Generate a commit message")
      );

      commitMessage = res.commitMessage;
      if (commitMessage) {
        aiResponse = res.aiResponse;
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

async function processStream(stream) {
  let aiResponse = "";
  let commitMessage = "";
  for await (const chunk of stream) {
    if ("function" in chunk) {
      if (chunk.function === "commitMessage") {
        commitMessage = chunk.result;
      }
      if (chunk.function === "askQuestion") {
        aiResponse = chunk.result;
      }
    }
  }

  return {
    aiResponse,
    commitMessage,
  };
}
