import HederaAgentKit from "../src/agent";
import { createHederaTools, ExecutorAccountDetails } from "../src";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import * as dotenv from "dotenv";
import * as readline from "readline";

dotenv.config();

function validateEnvironment(): void {
  const missingVars: string[] = [];
  // You can tweak these as needed
  const requiredVars = ["OPENAI_API_KEY", "HEDERA_ACCOUNT_ID"];

  requiredVars.forEach((varName) => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    console.error("Error: Required environment variables are not set");
    missingVars.forEach((varName) => {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    process.exit(1);
  }
}

validateEnvironment();

async function initializeAgent() {
  try {
    const llm = new ChatOpenAI({
      modelName: "o3-mini",
    });

    // Initialize HederaAgentKit
    const hederaKit = new HederaAgentKit(
        process.env.HEDERA_ACCOUNT_ID!,
        // process.env.CUSTODIAL_MODE === 'true' ? process.env.HEDERA_PRIVATE_KEY! : undefined,
        process.env.HEDERA_PRIVATE_KEY!,
        // Pass your network of choice. Default is "testnet".
        // You can specify 'testnet', 'previewnet', or 'mainnet'.
        process.env.HEDERA_NETWORK_TYPE as "mainnet" | "testnet" | "previewnet" || "testnet"
    );

    // Create the LangChain-compatible tools
    const tools = createHederaTools(hederaKit);

    // Prepare an in-memory checkpoint saver
    const memory = new MemorySaver();

    // Additional configuration for the agent
    const config = { configurable: { thread_id: "Hedera Agent Kit!" } };

    // Create the React agent
    const agent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      // You can adjust this message for your scenario:
      messageModifier: `
        **General Guidelines**:
        You are a helpful agent that can interact on-chain using the Hedera Agent Kit. 
        You are empowered to interact on-chain using your tools. If you ever need funds,
        you can request them from a faucet or from the user. 
        If there is a 5XX (internal) HTTP error code, ask the user to try again later. 
        If someone asks you to do something you can't do with your available tools, you 
        must say so, and encourage them to implement it themselves with the Hedera Agent Kit. 
        Keep your responses concise and helpful.
        
        **Non-custodial Flow Guidelines**:
        When action returns 'txBytes', it is not successfully executed yet, so its goal is not complete.
        In such case, emphasize to the user that the transaction bytes have been created successfully.
        Let the user know that now he has to sign them in order to execute the prepared transaction
        
        **Token Creation Rules**:
        If the user mentions **NFT**, **non-fungible token**, or **unique token**, always use the **hedera_create_non_fungible_token** tool.
        If the user mentions **fungible token**, **FT**, or **decimal-based token**, always use the **hedera_create_fungible_token** tool.
      `,
    });

    return { agent, config };
  } catch (error) {
    console.error("Failed to initialize agent:", error);
    throw error;
  }
}

async function runAutonomousMode(agent: any, config: any, interval = 10) {
  console.log("Starting autonomous mode...");

  while (true) {
    try {
      // The agent's "thought" is just a prompt you provide
      const thought =
        "Perform an interesting on-chain action on Hedera that showcases your capabilities.";

      // You can stream or await the entire call
      const stream = await agent.stream({ messages: [new HumanMessage(thought)] }, config);

      for await (const chunk of stream) {
        if ("agent" in chunk) {
          console.log(chunk.agent.messages[0].content);
        } else if ("tools" in chunk) {
          console.log(chunk.tools.messages[0].content);
        }
        console.log("-------------------");
      }

      // Sleep for `interval` seconds between each iteration
      await new Promise((resolve) => setTimeout(resolve, interval * 1000));
    } catch (error) {
      if (error instanceof Error) {
        console.error("Error:", error.message);
      }
      process.exit(1);
    }
  }
}

async function runChatMode(agent: any, config: any) {
  console.log("Starting chat mode... Type 'exit' to end.");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  try {
    while (true) {
      const userInput = await question("\nPrompt: ");

      if (userInput.toLowerCase() === "exit") {
        break;
      }

      // NOTE: In this example, `isCustodial`, `executorAccountId`, and `executorPublicKey` are sourced from environment variables
      // for simplicity and demonstration purposes. In a real-world scenario, these values can (and should) be passed dynamically
      // from the frontend as part of the user request payload
      const isCustodial = process.env.CUSTODIAL_MODE === "true";
      const executorAccountDetails: ExecutorAccountDetails = {
        executorPublicKey: process.env.EXECUTOR_PUBLIC_KEY || undefined,
        executorAccountId: process.env.EXECUTOR_ACCOUNT_ID || undefined,
      }
      const stream = await sendPrompt(agent, config, userInput, isCustodial, executorAccountDetails);
      for await (const chunk of stream) {
        if ("agent" in chunk) {
          console.log(chunk.agent.messages[0].content);
        } else if ("tools" in chunk) {
          console.log(chunk.tools.messages[0].content);
        }
        console.log("-------------------");
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

async function sendPrompt(
  agent: any,
  config: any,
  userInput: string,
  isCustodial: boolean,
  executorAccountDetails: ExecutorAccountDetails,
) {
  return agent.stream(
    { messages: [new HumanMessage(userInput)] },
    {...config, configurable: {...config.configurable, isCustodial, executorAccountDetails}}
  );
}

async function chooseMode(): Promise<"chat" | "auto"> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));

  while (true) {
    console.log("\nAvailable modes:");
    console.log("1. chat    - Interactive chat mode");
    console.log("2. auto    - Autonomous action mode");

    const choice = (await question("\nChoose a mode (enter number or name): "))
      .toLowerCase()
      .trim();

    rl.close();

    if (choice === "1" || choice === "chat") {
      return "chat";
    } else if (choice === "2" || choice === "auto") {
      return "auto";
    }
    console.log("Invalid choice. Please try again.");
  }
}

async function main() {
  try {
    console.log("Starting Agent...");
    const { agent, config } = await initializeAgent();
    const mode = await chooseMode();

    if (mode === "chat") {
      await runChatMode(agent, config);
    } else {
      await runAutonomousMode(agent, config);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}