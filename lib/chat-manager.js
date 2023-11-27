import { OpenAI } from "openai";
import { encoding_for_model } from "tiktoken";

export class ChatManager {
  constructor() {
    /**
     * @type {OpenAI.Chat.Completions.ChatCompletionMessageParam[]}
     */
    this.messages = [];

    this.functions =
      /*@type {Map<string, { schema: OpenAI.Chat.Completions.ChatCompletionTool; implementation: unknown; }>}*/ new Map();

    this.openai = new OpenAI();
    if (!this.openai.apiKey) {
      throw new Error("OpenAI API key not found.");
    }
  }

  /**
   * @param {string[]} messages
   */
  addSystemMessages(...message) {
    this.messages.push(...message.map((m) => ({ role: "system", content: m })));
  }

  /**
   * @param {string[]} messages
   */
  addAssistantMessages(...message) {
    this.messages.push(
      ...message.map((m) => ({ role: "assistant", content: m }))
    );
  }

  /**
   *
   * @param {OpenAI.FunctionDefinition} schema
   * @param {unknown} implementation
   */
  regiesterFunction(schema, implementation) {
    this.functions.set(schema.name, { schema, implementation });
  }

  /**
   * @param {string[]} messages
   * @returns {AsyncGenerator<{ message: string; } | { function: string; result: unknown; }>}
   */
  async sendMessages(...messages) {
    this.messages.push(...messages.map((m) => ({ role: "user", content: m })));

    const functions = Array.from(this.functions.values()).map((f) => ({
      type: "function",
      function: f.schema,
    }));

    const tools = functions.length > 0 ? [...functions] : undefined;

    // const model = "gpt-3.5-turbo-1106";
    // const modelInputCost = 0.001;
    // const modelOutputCost = 0.002;
    const model = "gpt-4-1106-preview";
    const modelInputCost = 0.01;
    const modelOutputCost = 0.03;

    const inputEnc = encoding_for_model(model);
    const inputTokens = inputEnc.encode(
      this.messages.map((m) => m.content).join("\n")
    );
    const cost = calculateQueryCost(modelInputCost, inputTokens.length);
    if (process.env.DEBUG) {
      console.log(
        "sending",
        inputTokens.length,
        "tokens at a cost of ~$" + cost.toFixed(4)
      );
    }
    inputEnc.free();

    const completion = await this.openai.chat.completions.create({
      messages: this.messages,
      model,
      stream: true,
      tools,
    });

    const functionCalls = [];

    const stream = new ReadableStream({
      start: async (controller) => {
        let allOutput = "";
        for await (const value of completion) {
          for (const choice of value.choices) {
            if (choice.delta.content) {
              allOutput += choice.delta.content;
              controller.enqueue({
                message: choice.delta.content,
              });
            }

            if (choice.delta.tool_calls?.length) {
              for (const toolCall of choice.delta.tool_calls) {
                if (!functionCalls[toolCall.index] && toolCall.function) {
                  functionCalls[toolCall.index] = {
                    name: toolCall.function.name,
                    arguments: toolCall.function.arguments || "",
                  };
                  allOutput +=
                    toolCall.function.name +
                    (toolCall.function.arguments || "");
                } else if (toolCall.function) {
                  functionCalls[toolCall.index].arguments +=
                    toolCall.function.arguments;
                  allOutput += toolCall.function.arguments;
                }
              }
            }
          }
        }

        const outputEnc = encoding_for_model(model);
        const outputTokens = outputEnc.encode(allOutput);
        const outputCost = calculateQueryCost(
          modelOutputCost,
          outputTokens.length
        );
        if (process.env.DEBUG) {
          console.log(
            "received",
            outputTokens.length,
            "tokens at a cost of ~$" + outputCost.toFixed(2)
          );
        }
        outputEnc.free();

        for (const functionCall of functionCalls) {
          const func = this.functions.get(functionCall.name);
          if (!func) {
            throw new Error(`Function ${functionCall.name} not found.`);
          }

          const result = await func.implementation(
            JSON.parse(functionCall.arguments)
          );

          controller.enqueue({
            function: functionCall.name,
            result,
          });
        }

        controller.close();
      },
    });

    return streamAsyncIterator(stream);
  }
}

async function* streamAsyncIterator(stream) {
  // Get a lock on the stream
  const reader = stream.getReader();

  try {
    while (true) {
      // Read from the stream
      const { done, value } = await reader.read();
      // Exit if we're done
      if (done) return;
      // Else yield the chunk
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

function calculateQueryCost(pricePerThousandTokens, numberOfTokens) {
  // Converts the price per 1000 tokens to a price per token
  const pricePerToken = pricePerThousandTokens / 1000;

  // Calculates the total cost
  const totalCost = pricePerToken * numberOfTokens;

  return totalCost;
}
