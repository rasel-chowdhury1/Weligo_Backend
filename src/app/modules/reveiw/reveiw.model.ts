import { Schema, model } from 'mongoose';
import { TReview, TReviewReply } from './review.interface';



const ReviewReplySchema = new Schema<TReviewReply>(
  {
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    repliedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const ReviewSchema = new Schema<TReview>(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: false,
    },

    reviewerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    receiverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
    },

    reply: {
      type: ReviewReplySchema,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

ReviewSchema.index(
  { bookingId: 1, reviewerId: 1 },
  { unique: true }
);

ReviewSchema.index({ receiverId: 1, isDeleted: 1 });
ReviewSchema.index({ bookingId: 1, isDeleted: 1 });

export const Review = model<TReview>('Review', ReviewSchema);

export default Review;