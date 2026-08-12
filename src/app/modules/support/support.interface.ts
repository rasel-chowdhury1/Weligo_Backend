import { Types } from "mongoose";

export enum SupportTicketStatus {
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
}

export enum SupportTicketSubject {
  BOOKING_ISSUE = "Booking Issue",
  RESCHEDULE_APPOINTMENT = "Reschedule Appointment",
  CANCEL_BOOKING = "Cancel Booking",
  PROVIDER_DIDNT_ARRIVE = "Provider Didn't Arrive",
  LATE_ARRIVAL = "Late Arrival",
  SERVICE_QUALITY_CONCERN = "Service Quality Concern",
  INCORRECT_CHARGES_BILLING = "Incorrect Charges / Billing",
  REFUND_REQUEST = "Refund Request",
  PAYMENT_FAILED = "Payment Failed",
  PAYMENT_INQUIRY = "Payment Inquiry",
  ACCOUNT_LOGIN_ISSUES = "Account & Login Issues",
  PROFILE_UPDATE = "Profile Update",
  COMMUNICATION_WITH_PROVIDER = "Communication with Provider",
  TECHNICAL_ISSUE = "Technical Issue",
  PROMO_CODE_DISCOUNT_ISSUE = "Promo Code / Discount Issue",
  REPORT_A_PROVIDER = "Report a Provider",
  SAFETY_CONCERN = "Safety Concern",
  GENERAL_INQUIRY = "General Inquiry",
  OTHER = "Other",
}

export interface IMessage {
  sender: Types.ObjectId;
  message: string;
  attachment?: string;
  createdAt?: Date;
}

export interface ISupportTicket {
  user: Types.ObjectId;

  ticketNumber: string;

  subject: SupportTicketSubject;

  title: string;

  description: string;

  status: SupportTicketStatus;

  messages: IMessage[];

  resolvedAt?: Date;

  createdAt?: Date;

  updatedAt?: Date;
}