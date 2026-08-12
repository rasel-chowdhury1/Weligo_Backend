import { Schema } from "mongoose";

export interface TReviewReply {
  comment: string;
  repliedAt: Date;
}

export interface TReview {
  bookingId: Schema.Types.ObjectId;
  reviewerId: Schema.Types.ObjectId;
  receiverId: Schema.Types.ObjectId;
  rating: number;
  comment?: string;
  reply?: TReviewReply;
  isDeleted: boolean;
}