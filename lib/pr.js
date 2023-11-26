import * as fsp from "node:fs/promises";

import enquirer from "enquirer";
import { execa } from "execa";

import { ChatManager } from "./chat-manager.js";
import {
  getActiveBranchName,
  getCommitsSince,
  getPackageJson,
} from "./utils.js";

const { prompt } = enquirer;

export async function pr() {
  const [branchName, pkgJson] = await Promise.all([
    getActiveBranchName(),
    getPackageJson(),
  ]);

  const baseBranch = pkgJson?.ai?.repo?.baseBranch || "main";
  const owner = pkgJson?.ai?.repo?.owner;
  const repo = pkgJson?.ai?.repo?.name;

  if (!owner || !repo) {
    throw new Error(
      "The package.json file is missing the ai.repo.owner and/or ai.repo.name fields."
    );
  }

  const commits = await getCommitsSince(baseBranch, branchName);

  const chat = new ChatManager();
  chat.regiesterFunction(
    {
      name: "newPullRequest",
      description: "Generate a new pull request",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "The pull request title",
          },
          body: {
            type: "string",
            description: "The pull request body",
          },
        },
        required: ["title", "body"],
      },
    },
    ({ title, body }) => ({ title, body })
  );
  chat.addSystemMessages(
    "Your task is to write a pull request for the current working repository. " +
      "The pull request title should be in the conventional commit format. " +
      "The pull request title should be no longer than 72 characters. " +
      "The pull request title should be followed by a longer body describing more detail. " +
      "Do not be vague in the pull request title and body. " +
      "If more context is needed you can ask a question to the user. "
  );

  const { aiResponse, pullRequest } = await processStream(
    await chat.sendMessages(
      `Contextual Information:\n\n` +
        `Branch Name: ${branchName}\n\n` +
        `Base Branch: ${baseBranch}\n\n` +
        `Commits:\n` +
        "```\n" +
        commits +
        "\n```",
      "Generate a pull request"
    )
  );

  if (pullRequest) {
    const answer = await prompt({
      type: "confirm",
      name: "confirm",
      message: `Would you like to create the following pull request?\n\n${pullRequest.title}\n\n${pullRequest.body}`,
    });

    if (answer?.confirm) {
      const githubPRUrl = new URL(
        `https://github.com/${owner}/${repo}/pull/new/${branchName}...${baseBranch}`
      );
      githubPRUrl.searchParams.append("title", pullRequest.title);
      githubPRUrl.searchParams.append("body", pullRequest.body);
      await execa("open", [githubPRUrl.toString()]);
      return;
    }
  }

  throw new Error("Pull request generation failed.");
}

async function processStream(stream) {
  let aiResponse = "";
  let pullRequest = null;
  for await (const chunk of stream) {
    if ("message" in chunk) {
      if (!aiResponse) {
        process.stdout.write("\n");
      }
      aiResponse += chunk.message;
      process.stdout.write(chunk.message);
    }

    if ("function" in chunk) {
      if (chunk.function === "newPullRequest") {
        pullRequest = chunk.result;
      }
    }
  }

  return {
    aiResponse,
    pullRequest,
  };
}
