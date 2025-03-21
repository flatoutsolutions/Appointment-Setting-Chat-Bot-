import { getUserSessionId, sendMessageToAssistant, getChatHistory } from "./sessionManager";

export type Message = {
  role: "user" | "assistant" | "system" | string;
  content: string;
};

/**
 * Processes a chat message and returns the response
 */
// Update the processMessage function in chatService.ts
export async function processMessage(message: string, isHiddenGreeting?: boolean): Promise<string> {
  try {
    // Get user-specific session ID
    const sessionId = await getUserSessionId();
    
    // Send message to OpenAI assistant and get response
    const response = await sendMessageToAssistant(sessionId, message, isHiddenGreeting);
    
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
    const messages = await getChatHistory(sessionId);
    
    // Map the messages to ensure they match the expected type
    return messages.map(msg => ({
      role: msg.role === "user" ? "user" : 
            msg.role === "assistant" ? "assistant" : 
            msg.role === "system" ? "system" : "assistant",
      content: msg.content
    }));
  } catch (error) {
    console.error("Error getting chat history:", error);
    return [];
  }
}