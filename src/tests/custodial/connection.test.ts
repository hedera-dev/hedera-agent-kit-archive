import { describe, it, expect} from "vitest";
import { LangchainAgent } from "../utils/langchainAgent";

describe("Test connection with Langchain", () => {
  it("Test connection with Langchain", async () => {
    try {
      const agent = await LangchainAgent.create();
      const conversation = await agent.sendPrompt({
        text: "Hello world!",
      });
      const response =
        conversation.messages[conversation.messages.length - 1].content;

      expect(response).toBeTruthy();
    } catch (error) {
      console.error(error);
      throw error;
    }
  });
});
