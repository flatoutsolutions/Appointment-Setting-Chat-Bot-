// Client-side utilities for the appointment system

/**
 * Format a date for display
 */
export const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };
  
  /**
   * Format a time for display
   */
  export const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
  };
  
  /**
   * Format a date range for display
   */
  export const formatDateRange = (startDate: Date, endDate: Date): string => {
    const start = startDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    
    const end = endDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    
    return `${start} - ${end}`;
  };
  
  /**
   * Get start and end dates for a given time range
   */
  export const getDateRange = (range: 'week' | 'month' | 'custom' = 'week', customDays?: number): {
    startDate: Date;
    endDate: Date;
  } => {
    const now = new Date();
    const startDate = new Date(now);
    const endDate = new Date(now);
    
    switch (range) {
      case 'week':
        // Next 7 days
        endDate.setDate(now.getDate() + 7);
        break;
      case 'month':
        // Next 30 days
        endDate.setDate(now.getDate() + 30);
        break;
      case 'custom':
        // Custom number of days
        if (customDays) {
          endDate.setDate(now.getDate() + customDays);
        } else {
          endDate.setDate(now.getDate() + 14); // Default to 2 weeks
        }
        break;
    }
    
    return { startDate, endDate };
  };
  
  /**
   * Group available slots by date
   */
  export const groupSlotsByDate = (slots: string[]): Record<string, string[]> => {
    const grouped: Record<string, string[]> = {};
    
    slots.forEach(slot => {
      const date = new Date(slot);
      const dateKey = date.toISOString().split('T')[0];
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      
      grouped[dateKey].push(slot);
    });
    
    return grouped;
  };
  
  /**
   * Get the current user's timezone
   */
  export const getUserTimezone = (): string => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (e) {
      return 'America/New_York'; // Default fallback
    }
  };
  
  /**
   * Fetches available appointment slots
   */
  export const fetchAvailableSlots = async (
    startDate: Date,
    endDate: Date,
    timezone: string = getUserTimezone()
  ): Promise<string[]> => {
    try {
      const response = await fetch(
        `/api/appointments?action=slots&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&timezone=${timezone}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch available slots');
      }
      
      const data = await response.json();
      return data.slots;
    } catch (error) {
      console.error('Error fetching available slots:', error);
      throw error;
    }
  };
  
  /**
   * Books an appointment
   */
  export const bookAppointmentSlot = async (
    slot: string,
    name: string,
    email: string,
    phone: string,
    timezone: string = getUserTimezone()
  ): Promise<any> => {
    try {
      const response = await fetch('/api/appointments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slot,
          timezone,
          name,
          email,
          phone,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to book appointment');
      }
      
      return response.json();
    } catch (error) {
      console.error('Error booking appointment:', error);
      throw error;
    }
  };
  
  /**
   * Gets user's booked appointments
   */
  export const getUserAppointments = async (email: string): Promise<any[]> => {
    try {
      const response = await fetch(`/api/appointments?action=userAppointments&email=${encodeURIComponent(email)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch user appointments');
      }
      
      const data = await response.json();
      return data.appointments;
    } catch (error) {
      console.error('Error fetching user appointments:', error);
      throw error;
    }
  };
  
  /**
   * Updates an existing appointment
   */
  export const updateAppointmentSlot = async (
    appointmentId: string,
    newSlot: string,
    timezone: string = getUserTimezone()
  ): Promise<any> => {
    try {
      const response = await fetch('/api/appointments', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appointmentId,
          newSlot,
          timezone,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update appointment');
      }
      
      return response.json();
    } catch (error) {
      console.error('Error updating appointment:', error);
      throw error;
    }
  };
  
  /**
   * Cancels an appointment
   */
  export const cancelAppointment = async (appointmentId: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/appointments', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appointmentId,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel appointment');
      }
      
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('Error canceling appointment:', error);
      throw error;
    }
  };