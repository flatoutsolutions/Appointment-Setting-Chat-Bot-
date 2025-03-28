import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { 
  getAvailableSlots, 
  bookAppointment, 
  getUserAppointments, 
  updateAppointment, 
  deleteAppointment 
} from "@/app/lib/ghlIntegration";

// Handler for GET requests to retrieve available slots
export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get query parameters
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "slots";
    
    if (action === "slots") {
      const startDateParam = url.searchParams.get("startDate");
      const endDateParam = url.searchParams.get("endDate");
      const timezone = url.searchParams.get("timezone") || "America/New_York";
      
      if (!startDateParam || !endDateParam) {
        return NextResponse.json(
          { error: "startDate and endDate are required" },
          { status: 400 }
        );
      }
      
      // Convert string dates to Date objects
      const startDate = new Date(startDateParam);
      const endDate = new Date(endDateParam);
      
      // Get available slots
      const slots = await getAvailableSlots(startDate, endDate, timezone);
      
      return NextResponse.json({ slots });
    } 
    else if (action === "userAppointments") {
      const email = url.searchParams.get("email");
      
      if (!email) {
        return NextResponse.json(
          { error: "email is required" },
          { status: 400 }
        );
      }
      
      // Get user appointments
      const appointments = await getUserAppointments(email);
      
      return NextResponse.json({ appointments });
    }
    else {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }
  } catch (error: unknown) {
    console.error("Error in appointment API:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// Handler for POST requests to book an appointment
export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { slot, timezone, name, email, phone } = body;
    
    if (!slot || !timezone || !name || !email || !phone) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Book appointment
    const result = await bookAppointment(slot, timezone, name, email, phone);

    // Return the response
    return NextResponse.json({ appointment: result });
  } catch (error: unknown) {
    console.error("Error booking appointment:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred booking the appointment";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// Handler for PUT requests to update an appointment
export async function PUT(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { appointmentId, newSlot, timezone } = body;
    
    if (!appointmentId || !newSlot || !timezone) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Update appointment
    const result = await updateAppointment(appointmentId, newSlot, timezone);

    // Return the response
    return NextResponse.json({ appointment: result });
  } catch (error: unknown) {
    console.error("Error updating appointment:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred updating the appointment";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// Handler for DELETE requests to delete an appointment
export async function DELETE(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { appointmentId } = body;
    
    if (!appointmentId) {
      return NextResponse.json(
        { error: "appointmentId is required" },
        { status: 400 }
      );
    }

    // Delete appointment
    const success = await deleteAppointment(appointmentId);

    // Return the response
    return NextResponse.json({ success });
  } catch (error: unknown) {
    console.error("Error deleting appointment:", error);
    const errorMessage = error instanceof Error ? error.message : "An error occurred deleting the appointment";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}