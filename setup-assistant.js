// setup-assistant.js
import OpenAI from "openai";
import * as dotenv from "dotenv";

// Configure dotenv to read from .env.local
dotenv.config({ path: '.env.local' });

const openai = new OpenAI({
  // The API key will be loaded from .env.local
  apiKey: process.env.OPENAI_API_KEY,
});

async function main() {
  const assistant = await openai.beta.assistants.create({
    name: "Chat Assistant",
    instructions: "You are a helpful AI assistant. You remember previous conversations with users and provide accurate, helpful responses.", 
    model: "gpt-4o",
  });
  
  console.log("Assistant created with ID:", assistant.id);
  console.log("Add this ID to your .env.local file as OPENAI_ASSISTANT_ID");
}

main().catch(console.error);