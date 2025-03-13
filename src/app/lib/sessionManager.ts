import { auth } from "@clerk/nextjs/server";
import { ChatOpenAI } from "@langchain/openai";
import { BufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import { UpstashRedisChatMessageHistory } from "@langchain/community/stores/message/upstash_redis";

/**
 * Creates a unique session ID for a user
 * Format: user_{userId}
 */
export const getUserSessionId = async (): Promise<string> => {
  try {
    const { userId } = await auth();
    if (!userId) {
      throw new Error("User not authenticated");
    }
    return `user_${userId}`;
  } catch (error) {
    console.error("Error getting user ID:", error);
    throw error;
  }
};

/**
 * Creates a chat chain with memory stored in Redis
 */
export const createChatChain = async (sessionId: string) => {
  // Initialize chat history from Redis
  const chatHistory = new UpstashRedisChatMessageHistory({
    sessionId,
    config: {
      url: process.env.UPSTASH_REDIS_REST_URL || "",
      token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
    },
  });

  // Create memory with chat history
  const memory = new BufferMemory({
    chatHistory,
    returnMessages: true,
    memoryKey: "history",
  });

  // Initialize OpenAI model
  const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0.4,
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  // Create and return the conversation chain
  return new ConversationChain({
    llm: model,
    memory,
  });
};

/**
 * Gets chat history for a session
 */
export const getChatHistory = async (sessionId: string) => {
  const chatHistory = new UpstashRedisChatMessageHistory({
    sessionId,
    config: {
      url: process.env.UPSTASH_REDIS_REST_URL || "",
      token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
    },
  });

  return chatHistory.getMessages();
};

/**
 * Clears chat history for a session
 */
export const clearChatHistory = async (sessionId: string) => {
  const chatHistory = new UpstashRedisChatMessageHistory({
    sessionId,
    config: {
      url: process.env.UPSTASH_REDIS_REST_URL || "",
      token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
    },
  });

  return chatHistory.clear();
};