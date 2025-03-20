import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { Redis } from "@upstash/redis";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Create a Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

// Assistant ID (you'll need to create this once and store the ID)
const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID || "";

/**
 * Creates a unique session ID for a user
 * Format: user_{userId}
 */
export const getUserSessionId = async (): Promise<string> => {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("User not authenticated");
  }
  return `user_${userId}`;
};

/**
 * Gets or creates a thread for the user
 */
export const getUserThread = async (sessionId: string): Promise<string> => {
  // Check if thread ID exists in Redis
  let threadId = await redis.get<string>(`thread:${sessionId}`);
  
  if (!threadId) {
    // Create a new thread if none exists
    const thread = await openai.beta.threads.create();
    threadId = thread.id;
    
    // Store the thread ID in Redis
    await redis.set(`thread:${sessionId}`, threadId);
  }
  
  return threadId;
};

/**
 * Adds a message to the thread and runs the assistant
 */
export const sendMessageToAssistant = async (
  sessionId: string,
  message: string
): Promise<string> => {
  // Get thread ID for the user
  const threadId = await getUserThread(sessionId);
  
  // Add message to the thread
  await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content: message,
  });
  
  // Run the assistant on the thread
  const run = await openai.beta.threads.runs.create(threadId, {
    assistant_id: ASSISTANT_ID,
  });
  
  // Wait for the run to complete
  let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
  
  // Poll until the run is completed
  while (runStatus.status !== "completed" && runStatus.status !== "failed") {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
    runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    
    if (runStatus.status === "requires_action") {
      // Handle tools if needed - for this implementation we're not using tools
      console.log("Run requires action");
    }
  }
  
  if (runStatus.status === "failed") {
    throw new Error("Assistant run failed");
  }
  
  // Get the latest messages
  const messages = await openai.beta.threads.messages.list(threadId);
  
  // Get the latest assistant message
  const latestMessage = messages.data
    .filter((msg) => msg.role === "assistant")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  
  if (!latestMessage) {
    return "No response from assistant";
  }
  
  // Extract the text content
  let responseText = "";
  for (const content of latestMessage.content) {
    if (content.type === "text") {
      responseText += content.text.value;
    }
  }
  
  return responseText;
};

/**
 * Gets chat history for a user's thread
 */
export const getChatHistory = async (sessionId: string) => {
  try {
    // Get thread ID for the user
    const threadId = await getUserThread(sessionId);
    
    // Get messages from the thread
    const messages = await openai.beta.threads.messages.list(threadId);
    
    // Transform to our expected format
    return messages.data.map((msg) => {
      // Extract text content
      let content = "";
      for (const contentPart of msg.content) {
        if (contentPart.type === "text") {
          content += contentPart.text.value;
        }
      }
      
      return {
        role: msg.role === "user" ? "user" : "assistant",
        content,
      };
    }).reverse(); // Reverse to get chronological order
  } catch (error) {
    console.error("Error getting chat history:", error);
    return [];
  }
};

/**
 * Clears chat history by creating a new thread
 */
export const clearChatHistory = async (sessionId: string) => {
  // Create a new thread
  const thread = await openai.beta.threads.create();
  
  // Update the thread ID in Redis
  await redis.set(`thread:${sessionId}`, thread.id);
  
  return true;
};