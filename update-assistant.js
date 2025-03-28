// update-assistant.js
import OpenAI from "openai";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Attempt to load from .env.local first
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log("Loaded environment from .env.local");
} else {
  // Fall back to .env
  dotenv.config();
  console.log("Loaded environment from .env");
}

// Get API key from environment or use direct value if needed
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error("Error: OPENAI_API_KEY not found in environment variables");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: apiKey
});

// Function definitions for the Assistant
const appointmentFunctions = [
  {
    "type": "function",
    "function": {
      "name": "get_available_slots",
      "description": "Get available appointment slots within a date range",
      "parameters": {
        "type": "object",
        "properties": {
          "start_date": {
            "type": "string",
            "format": "date",
            "description": "The start date for checking available slots (YYYY-MM-DD)"
          },
          "end_date": {
            "type": "string",
            "format": "date",
            "description": "The end date for checking available slots (YYYY-MM-DD)"
          },
          "timezone": {
            "type": "string",
            "description": "The timezone for the appointment slots",
            "default": "America/New_York"
          }
        },
        "required": ["start_date", "end_date"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "book_appointment",
      "description": "Book an appointment at a specific time slot",
      "parameters": {
        "type": "object",
        "properties": {
          "slot": {
            "type": "string",
            "description": "The ISO8601 datetime of the appointment slot"
          },
          "name": {
            "type": "string",
            "description": "Customer's full name"
          },
          "email": {
            "type": "string",
            "description": "Customer's email address"
          },
          "phone": {
            "type": "string",
            "description": "Customer's phone number"
          },
          "timezone": {
            "type": "string",
            "description": "The timezone for the appointment"
          }
        },
        "required": ["slot", "name", "email", "phone"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "get_user_appointments",
      "description": "Get a user's upcoming appointments by email",
      "parameters": {
        "type": "object",
        "properties": {
          "email": {
            "type": "string",
            "description": "Customer's email address to look up appointments"
          }
        },
        "required": ["email"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "update_appointment",
      "description": "Reschedule an existing appointment",
      "parameters": {
        "type": "object",
        "properties": {
          "appointment_id": {
            "type": "string",
            "description": "ID of the appointment to update"
          },
          "new_slot": {
            "type": "string",
            "description": "The new ISO8601 datetime for the appointment"
          },
          "timezone": {
            "type": "string",
            "description": "The timezone for the appointment"
          }
        },
        "required": ["appointment_id", "new_slot"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "cancel_appointment",
      "description": "Cancel an existing appointment",
      "parameters": {
        "type": "object",
        "properties": {
          "appointment_id": {
            "type": "string",
            "description": "ID of the appointment to cancel"
          }
        },
        "required": ["appointment_id"]
      }
    }
  }
];

// Function to update the Assistant
async function updateAssistant() {
  try {
    // Replace with your assistant ID from .env
    const assistantId = process.env.OPENAI_ASSISTANT_ID;
    
    console.log(`Updating Assistant ID: ${assistantId}`);
    
    // Get the current assistant
    const currentAssistant = await openai.beta.assistants.retrieve(assistantId);
    console.log("Retrieved existing assistant");
    
    // Update the assistant with the new tools
    const updatedAssistant = await openai.beta.assistants.update(
      assistantId,
      {
        tools: appointmentFunctions,
        instructions: `${currentAssistant.instructions}\n\nYou can now help users schedule, reschedule, and cancel appointments using the provided appointment functions. When a user asks about appointments, use these functions to help them. For scheduling, ask for their preferred date/time, name, email, and phone number. For rescheduling or cancelling, ask for their email to locate existing appointments. Always confirm the details of any booking or change with the user.`
      }
    );
    
    console.log("Updated Assistant successfully:", updatedAssistant.id);
  } catch (error) {
    console.error("Error updating assistant:", error);
  }
}

// Run the update function
updateAssistant();