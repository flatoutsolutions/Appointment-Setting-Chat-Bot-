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

// Assistant ID (you'll need to create this once and store the ID)
const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID || "";

// GHL Configuration
const GHL_API_TOKEN = process.env.GHL_API_TOKEN || "";
const GHL_CALENDAR_ID = process.env.GHL_CALENDAR_ID || "ocQHyuzHvysMo5N5VsXc"; // Default calendar ID
const GHL_API_VERSION = "2021-04-15";

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
 * Get available appointment slots from GHL
 */
export const getAvailableSlots = async (
  startDate: Date,
  endDate: Date,
  timezone: string = "America/New_York"
): Promise<string[]> => {
  try {
    console.log(`Getting available slots: ${startDate} to ${endDate}, timezone: ${timezone}`);
    
    // Ensure endDate is at least one week after startDate for a good range
    const actualEndDate = new Date(endDate);
    actualEndDate.setDate(actualEndDate.getDate() + 6);
    
    // Convert dates to timestamps
    const startTimestamp = startDate.getTime();
    const endTimestamp = actualEndDate.getTime();

    console.log(`Using calendar ID: ${GHL_CALENDAR_ID}`);
    console.log(`Start timestamp: ${startTimestamp}, End timestamp: ${endTimestamp}`);

    // Make API request
    const response = await axios.get(
      `https://services.leadconnectorhq.com/calendars/${GHL_CALENDAR_ID}/free-slots`,
      {
        headers: {
          "Authorization": `Bearer ${GHL_API_TOKEN}`,
          "Version": GHL_API_VERSION,
          "Accept": "application/json"
        },
        params: {
          startDate: startTimestamp,
          endDate: endTimestamp,
          timezone,
          enableLookBusy: false
        }
      }
    );

    console.log("API Response status:", response.status);
    
    // Extract all slots from the date-based response structure
    let allSlots: string[] = [];
    
    // Remove non-date keys like traceId
    const dateKeys = Object.keys(response.data).filter(key => key.match(/^\d{4}-\d{2}-\d{2}$/));
    
    // Process each date's slots
    for (const dateKey of dateKeys) {
      const dateData = response.data[dateKey];
      if (dateData && Array.isArray(dateData.slots)) {
        allSlots = allSlots.concat(dateData.slots);
      }
    }
    
    console.log(`Found ${allSlots.length} total available slots`);
    return allSlots;
  } catch (error) {
    console.error("Error getting available slots:", error);
    if (error.response) {
      console.error("Error details:", error.response.data);
    }
    return [];
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
    console.log(`Booking appointment: ${slot}, ${name}, ${email}, ${phone}`);
    
    // Split name into first and last name
    const nameParts = name.split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    
    // Updated payload based on documentation
    const payload = {
      calendarId: GHL_CALENDAR_ID,
      selectedTimezone: timezone,
      selectedSlot: slot,
      firstName,
      lastName,
      email,
      phone
    };

    console.log("Sending appointment request with payload:", JSON.stringify(payload));

    // Use the documented endpoint
    const response = await axios.post(
      "https://services.leadconnectorhq.com/calendars/events/appointments",
      payload,
      {
        headers: {
          "Authorization": `Bearer ${GHL_API_TOKEN}`,
          "Version": GHL_API_VERSION,
          "Content-Type": "application/json",
          "Accept": "application/json"
        }
      }
    );

    console.log("Booking response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error booking appointment:", error);
    console.error("Error details:", error.response?.data || error.message);
    return { error: error.message || "Failed to book appointment" };
  }
};

/**
 * Get all appointments for a user by email
 */
export const getUserAppointments = async (
  email: string
): Promise<any[]> => {
  try {
    console.log(`Getting appointments for email: ${email}`);
    
    // Default date range: today to 3 months ahead
    const startDate = new Date();
    const endDate = new Date(new Date().setMonth(new Date().getMonth() + 3));
    
    // Convert dates to timestamps
    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();

    // Use the documented endpoint
    const response = await axios.get(
      `https://services.leadconnectorhq.com/calendars/events/appointments`,
      {
        headers: {
          "Authorization": `Bearer ${GHL_API_TOKEN}`,
          "Version": GHL_API_VERSION,
          "Accept": "application/json"
        },
        params: {
          startDate: startTimestamp,
          endDate: endTimestamp,
          calendarId: GHL_CALENDAR_ID,
          includeAll: true
        }
      }
    );

    console.log("Got appointments response:", response.data);

    // Filter appointments for the specified email
    if (response.data && response.data.appointments) {
      return response.data.appointments.filter(
        (appt: any) => appt.contact && appt.contact.email === email
      );
    }

    return [];
  } catch (error) {
    console.error("Error getting user appointments:", error);
    console.error("Error details:", error.response?.data || error.message);
    return [];
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
    console.log(`Updating appointment: ${appointmentId} to ${newSlot}`);
    
    const payload = {
      selectedTimezone: timezone,
      selectedSlot: newSlot
    };

    // Use the documented endpoint
    const response = await axios.put(
      `https://services.leadconnectorhq.com/calendars/events/appointments/${appointmentId}`,
      payload,
      {
        headers: {
          "Authorization": `Bearer ${GHL_API_TOKEN}`,
          "Version": GHL_API_VERSION,
          "Content-Type": "application/json",
          "Accept": "application/json"
        }
      }
    );

    console.log("Update response:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error updating appointment:", error);
    console.error("Error details:", error.response?.data || error.message);
    return { error: error.message || "Failed to update appointment" };
  }
};

/**
 * Delete an appointment
 */
export const deleteAppointment = async (appointmentId: string): Promise<boolean> => {
  try {
    console.log(`Deleting appointment: ${appointmentId}`);
    
    // Use the documented endpoint
    const response = await axios.delete(
      `https://services.leadconnectorhq.com/calendars/events/appointments/${appointmentId}`,
      {
        headers: {
          "Authorization": `Bearer ${GHL_API_TOKEN}`,
          "Version": GHL_API_VERSION,
          "Accept": "application/json"
        }
      }
    );

    console.log("Delete response:", response.status);
    return response.status === 200;
  } catch (error) {
    console.error("Error deleting appointment:", error);
    console.error("Error details:", error.response?.data || error.message);
    return false;
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
    
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    
    // Poll until the run is completed or requires action
    while (
      runStatus.status !== "completed" &&
      runStatus.status !== "failed" &&
      runStatus.status !== "requires_action"
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    }
    
    // Handle function calls if needed
    if (runStatus.status === "requires_action" && runStatus.required_action?.type === "submit_tool_outputs") {
      console.log("Assistant is requesting function execution");
      
      const toolCalls = runStatus.required_action.submit_tool_outputs.tool_calls;
      const toolOutputs = [];
      
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        
        console.log(`Executing function: ${functionName} with args:`, functionArgs);
        
        let output;
        switch (functionName) {
          case "get_available_slots":
            output = await getAvailableSlots(
              new Date(functionArgs.start_date),
              new Date(functionArgs.end_date),
              functionArgs.timezone || "America/New_York"
            );
            break;
            
          case "book_appointment":
            output = await bookAppointment(
              functionArgs.slot,
              functionArgs.timezone || "America/New_York",
              functionArgs.name,
              functionArgs.email,
              functionArgs.phone
            );
            break;
            
          case "get_user_appointments":
            output = await getUserAppointments(functionArgs.email);
            break;
            
          case "update_appointment":
            output = await updateAppointment(
              functionArgs.appointment_id,
              functionArgs.new_slot,
              functionArgs.timezone || "America/New_York"
            );
            break;
            
          case "cancel_appointment":
            output = await deleteAppointment(functionArgs.appointment_id);
            break;
            
          default:
            output = { error: `Unknown function: ${functionName}` };
        }
        
        console.log(`Function result:`, output);
        
        toolOutputs.push({
          tool_call_id: toolCall.id,
          output: JSON.stringify(output),
        });
      }
      
      // Submit tool outputs back to the assistant
      console.log("Submitting results back to assistant");
      
      runStatus = await openai.beta.threads.runs.submitToolOutputs(
        threadId,
        run.id,
        { tool_outputs: toolOutputs }
      );
      
      // Continue polling until completion
      while (runStatus.status !== "completed" && runStatus.status !== "failed") {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      }
    }
    
    if (runStatus.status === "failed") {
      console.error("Assistant run failed:", runStatus.last_error);
      throw new Error(runStatus.last_error?.message || "Assistant run failed");
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