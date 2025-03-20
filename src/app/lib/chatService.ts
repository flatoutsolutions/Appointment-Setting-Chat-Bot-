import { getUserSessionId, sendMessageToAssistant, getChatHistory } from "./sessionManager";

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
    
    // Send message to OpenAI assistant and get response
    const response = await sendMessageToAssistant(sessionId, message);
    
    return response;
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
    
    // Get chat history from OpenAI thread
    return await getChatHistory(sessionId);
  } catch (error) {
    console.error("Error getting chat history:", error);
    return [];
  }
}