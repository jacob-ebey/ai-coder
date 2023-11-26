import enquirer from "enquirer";
import { execa } from "execa";

import { ChatManager } from "./chat-manager.js";
import {
  getActiveBranchName,
  getCommitsSince,
  getPackageJson,
  pushBranch,
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

  await pushBranch(branchName);

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
    "Your task is to write a pull request for the current working repository. " +
      "The pull request title should be in the conventional commit format. " +
      "The pull request title should be no longer than 72 characters. " +
      "The pull request title should be followed by a longer body describing more detail. " +
      "Focus on feature changes, not code details. " +
      "Do not include commit hashes or commit numbers in the pull request title or body. " +
      "Always ask a follow up question to the user for more context that would be useful to iterating on the pull request."
  );

  let { aiResponse, pullRequest } = await processStream(
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
        `https://github.com/${owner}/${repo}/compare/${baseBranch}...${branchName}`
      );
      githubPRUrl.searchParams.append("expand", "1");
      githubPRUrl.searchParams.append("title", pullRequest.title);
      githubPRUrl.searchParams.append("body", pullRequest.body);
      await execa("open", [githubPRUrl.toString()]);
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

    aiResponse = "Any additional information?";
    pullRequest = null;

    if (answer?.response) {
      const res = await processStream(
        await chat.sendMessages(answer.response, "Generate a pull request")
      );
      aiResponse = res.aiResponse || aiResponse;
      pullRequest = res.pullRequest;

      if (pullRequest) {
        const answer = await prompt({
          type: "confirm",
          name: "confirm",
          message: `Would you like to create the following pull request?\n\n${pullRequest.title}\n\n${pullRequest.body}`,
        });

        if (answer?.confirm) {
          const githubPRUrl = new URL(
            `https://github.com/${owner}/${repo}/compare/${baseBranch}...${branchName}`
          );
          githubPRUrl.searchParams.append("expand", "1");
          githubPRUrl.searchParams.append("title", pullRequest.title);
          githubPRUrl.searchParams.append("body", pullRequest.body);
          await execa("open", [githubPRUrl.toString()]);
          return;
        }
      }
    }
  }

  throw new Error("Pull request generation failed.");
}

async function processStream(stream) {
  let aiResponse = "";
  let pullRequest = null;
  for await (const chunk of stream) {
    if ("function" in chunk) {
      if (chunk.function === "newPullRequest") {
        pullRequest = chunk.result;
      }
      if (chunk.function === "askQuestion") {
        aiResponse = chunk.result;
      }
    }
  }

  return {
    aiResponse,
    pullRequest,
  };
}
