// updated-test-ghl-api.js
const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const GHL_API_TOKEN = process.env.GHL_API_TOKEN;
const GHL_CALENDAR_ID = process.env.GHL_CALENDAR_ID;

async function testGhlApi() {
  try {
    console.log("Testing GHL API");
    console.log("Calendar ID:", GHL_CALENDAR_ID);
    
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 7);
    
    const startTimestamp = startDate.getTime();
    const endTimestamp = endDate.getTime();
    
    // Try getting all calendars first
    console.log("Fetching list of calendars...");
    const calendarListResponse = await axios.get(
      "https://rest.gohighlevel.com/v1/calendars/",
      {
        headers: {
          "Authorization": `Bearer ${GHL_API_TOKEN}`
        }
      }
    );
    
    console.log("Calendars:", JSON.stringify(calendarListResponse.data, null, 2));
    
    // Now try getting available slots using the correct calendar ID from the list
    const response = await axios.get(
      `https://rest.gohighlevel.com/v1/appointments/slots`,
      {
        headers: {
          "Authorization": `Bearer ${GHL_API_TOKEN}`
        },
        params: {
          calendarId: GHL_CALENDAR_ID,
          startDate: startTimestamp,
          endDate: endTimestamp,
          timezone: "America/New_York"
        }
      }
    );
    
    console.log("Success! API Response:", JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error("API Test Failed:", error.message);
    if (error.response) {
      console.error("Error data:", error.response.data);
      console.error("Error status:", error.response.status);
    }
  }
}

testGhlApi();