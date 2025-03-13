import { createChatChain, getUserSessionId, getChatHistory } from "./sessionManager";
import { AIMessage, HumanMessage } from "@langchain/core/messages";

export type Message = {
  role: "user" | "assistant";
  content: string;
};

/**
 * Processes a chat message and returns the response
 */
export async function processMessage(message: string): Promise<string> {
  try {
    // Get user-specific session ID
    const sessionId = await getUserSessionId();
    
    // Create chat chain with memory
    const chain = await createChatChain(sessionId);
    
    // Process the message
    const response = await chain.call({ input: message });
    
    return response.response;
  } catch (error) {
    console.error("Error processing message:", error);
    return "Sorry, there was an error processing your message.";
  }
}

/**
 * Gets the chat history for the current user
 */
export async function getUserChatHistory(): Promise<Message[]> {
  try {
    // Get user-specific session ID
    const sessionId = await getUserSessionId();
    
    // Get chat history from Redis
    const messages = await getChatHistory(sessionId);
    
    // Transform to the expected format
    return messages.map(msg => {
      if (msg instanceof HumanMessage) {
        return { role: "user", content: msg.content as string };
      } else if (msg instanceof AIMessage) {
        return { role: "assistant", content: msg.content as string };
      }
      return { role: "user", content: "Message type not supported" };
    });
  } catch (error) {
    console.error("Error getting chat history:", error);
    return [];
  }
}