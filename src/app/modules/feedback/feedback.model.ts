import { Schema, model } from "mongoose";
import { IFeedback } from "./feedback.interface";

const feedbackSchema = new Schema<IFeedback>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    adminVerified: {
      type: String,
      enum: ["pending", "verified", 'declined'],
      default: "pending"
    },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Feedback = model<IFeedback>("Feedback", feedbackSchema);
