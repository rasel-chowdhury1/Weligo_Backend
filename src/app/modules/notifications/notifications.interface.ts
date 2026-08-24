import { Schema } from "mongoose";


export interface INotification {
    userId: Schema.Types.ObjectId; // Reference to User
    receiverId: Schema.Types.ObjectId; // Reference to User
    message: { 
      fullName?: string;
      image: string; // URL or path to the user's image
      text: string; // Additional data (text or other relevant information)
      photos?: string[]; // Optional array of photo URLs or paths
    };
    type:
      | "Join"
      | "SendFollow"
      | "AcceptFollow"
      | "DeclineFollow"
      | "interested"
      | "notInterested"
      | "Accepted"
      | "Rejected"
      | "added"
      // booking lifecycle notifications
      | "BookingAccepted"
      | "BookingDeclined"
      | "BookingWithdrawn"
      | "BookingConfirmed"
      | "BookingCancelled"
      | "BookingRescheduled"
      | "JobStarted"
      | "JobMarkedDone"
      | "BookingCompleted"
      | "PaymentReleased"; // Type of notification
    isRead: boolean; // Whether the notification is read
    
  }