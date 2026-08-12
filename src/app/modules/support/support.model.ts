import { Schema, model } from "mongoose";
import {
  IMessage,
  ISupportTicket,
  SupportTicketStatus,
  SupportTicketSubject,
} from "./support.interface";

const MessageSchema = new Schema<IMessage>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    attachment: {
      type: String,
    },
  },
  {
    _id: false,
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  }
);

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    ticketNumber: {
      type: String,
      required: true,
      unique: true,
      default: () =>
        `TCK-${Date.now().toString(36).toUpperCase()}-${Math.random()
          .toString(36)
          .slice(2, 6)
          .toUpperCase()}`,
    },

    subject: {
      type: String,
      enum: Object.values(SupportTicketSubject),
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: Object.values(SupportTicketStatus),
      default: SupportTicketStatus.OPEN,
    },

    messages: {
      type: [MessageSchema],
      default: [],
    },

    resolvedAt: Date,
  },
  {
    timestamps: true,
  }
);

export const SupportTicket = model<ISupportTicket>(
  "SupportTicket",
  SupportTicketSchema
);