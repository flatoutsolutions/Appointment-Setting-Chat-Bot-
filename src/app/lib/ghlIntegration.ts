import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { Redis } from "@upstash/redis";
import axios from "axios";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Create a Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

// GHL Configuration
const GHL_API_TOKEN = process.env.GHL_API_TOKEN || "";
const GHL_CALENDAR_ID = process.env.GHL_CALENDAR_ID || "ocQHyuzHvysMo5N5VsXc"; // Default calendar ID
const GHL_API_VERSION = "2021-04-15";

// Assistant ID
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
  try {
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
  } catch (error) {
    console.error('Error in getUserThread:', error);
    throw error;
  }
};

/**
 * Adds a message to the thread and runs the assistant
 */
export const sendMessageToAssistant = async (
  sessionId: string,
  message: string,
  isHiddenGreeting?: boolean
): Promise<string> => {
  try {
    // Get thread ID for the user
    const threadId = await getUserThread(sessionId);
    
    // Add message to the thread
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message,
      metadata: isHiddenGreeting ? { hidden: "true" } : undefined,
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
  } catch (error) {
    console.error("Error in sendMessageToAssistant:", error);
    throw error;
  }
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
    return messages.data
      .filter(msg => {
        // Filter out hidden greeting messages
        if (msg.role === "user" && msg.metadata && msg.metadata.hidden === "true") {
          return false;
        }
        return true;
      })
      .map((msg) => {
        // Extract text content
        let content = "";
        for (const contentPart of msg.content) {
          if (contentPart.type === "text") {
            content += contentPart.text.value;
          }
        }
        
        return {
          role: msg.role,
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
  try {
    // Create a new thread
    const thread = await openai.beta.threads.create();
    
    // Update the thread ID in Redis
    await redis.set(`thread:${sessionId}`, thread.id);
    
    return true;
  } catch (error) {
    console.error("Error clearing chat history:", error);
    throw error;
  }
};

/**
 * Get available appointment slots from GHL
 */
export const getAvailableSlots = async (
  startDate: Date,
  endDate: Date,
  timezone: string = "America/New_York"
): Promise<string[]> => {
  try {
    // Convert dates to timestamps
    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();

    // Make API request
    const response = await axios.get(
      `https://services.leadconnectorhq.com/calendars/${GHL_CALENDAR_ID}/free-slots`,
      {
        headers: {
          Authorization: `Bearer ${GHL_API_TOKEN}`,
          Version: GHL_API_VERSION,
          Accept: "application/json"
        },
        params: {
          startDate: startTimestamp,
          endDate: endTimestamp,
          timezone,
          enableLookBusy: false
        }
      }
    );

    // Extract slots from response
    if (response.data && response.data._dates && response.data._dates.slots) {
      return response.data._dates.slots;
    }

    return [];
  } catch (error) {
    console.error("Error getting available slots:", error);
    throw error;
  }
};

/**
 * Book an appointment slot
 */
export const bookAppointment = async (
  slot: string,
  timezone: string,
  name: string,
  email: string,
  phone: string
): Promise<any> => {
  try {
    const payload = {
      calendarId: GHL_CALENDAR_ID,
      selectedTimezone: timezone,
      selectedSlot: slot,
      name,
      email,
      phone
    };

    const response = await axios.post(
      "https://rest.gohighlevel.com/v1/appointments/",
      payload,
      {
        headers: {
          Authorization: `Bearer ${GHL_API_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error("Error booking appointment:", error);
    throw error;
  }
};

/**
 * Get all appointments for a user by email
 */
export const getUserAppointments = async (
  email: string,
  startDate: Date = new Date(),
  endDate: Date = new Date(new Date().setMonth(new Date().getMonth() + 3))  // Default to 3 months ahead
): Promise<any[]> => {
  try {
    // Convert dates to timestamps
    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();

    const response = await axios.get(
      `https://rest.gohighlevel.com/v1/appointments/`,
      {
        headers: {
          Authorization: `Bearer ${GHL_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        params: {
          startDate: startTimestamp,
          endDate: endTimestamp,
          calendarId: GHL_CALENDAR_ID,
          includeAll: true
        }
      }
    );

    // Filter appointments for the specified email
    if (response.data && response.data.appointments) {
      return response.data.appointments.filter(
        (appt: any) => appt.contact && appt.contact.email === email
      );
    }

    return [];
  } catch (error) {
    console.error("Error getting user appointments:", error);
    throw error;
  }
};

/**
 * Update an existing appointment
 */
export const updateAppointment = async (
  appointmentId: string,
  newSlot: string,
  timezone: string
): Promise<any> => {
  try {
    const payload = {
      selectedTimezone: timezone,
      selectedSlot: newSlot
    };

    const response = await axios.put(
      `https://rest.gohighlevel.com/v1/appointments/${appointmentId}`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${GHL_API_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error("Error updating appointment:", error);
    throw error;
  }
};

/**
 * Delete an appointment
 */
export const deleteAppointment = async (appointmentId: string): Promise<boolean> => {
  try {
    const response = await axios.delete(
      `https://rest.gohighlevel.com/v1/appointments/${appointmentId}`,
      {
        headers: {
          Authorization: `Bearer ${GHL_API_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.status === 200;
  } catch (error) {
    console.error("Error deleting appointment:", error);
    throw error;
  }
};

/**
 * Convert a date object to ISO 8601 format with timezone
 */
export const formatDateToISO = (date: Date, timezone: string): string => {
  // This is a simplified version - in production you'd want to use a library like date-fns-tz
  const isoDate = date.toISOString();
  return isoDate;
};