import httpStatus from 'http-status';
import { Types } from 'mongoose';
import AppError from '../../error/AppError';
import QueryBuilder from '../../builder/QueryBuilder';
import { Review } from './reveiw.model';
import { Booking } from '../booking/booking.model';
import { User } from '../user/user.models';

// recomputes the receiver's totalReview/averageRating from their non-deleted
// reviews - called after any create/update(rating)/delete so the two stay
// in sync with the Review collection rather than being incremented/decremented
const recalculateUserRating = async (userId: string) => {
  const [stats] = await Review.aggregate([
    {
      $match: {
        receiverId: new Types.ObjectId(userId),
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReview: { $sum: 1 },
      },
    },
  ]);

  await User.findByIdAndUpdate(userId, {
    averageRating: stats ? Math.round(stats.averageRating * 10) / 10 : 0,
    totalReview: stats ? stats.totalReview : 0,
  });
};

export type TCreateReviewPayload = {
  bookingId: string;
  rating: number;
  comment?: string;
};

const createReview = async (
  reviewerId: string,
  payload: TCreateReviewPayload,
) => {
  const { bookingId, rating, comment } = payload;

  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  if (booking.status !== 'completed') {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You can only review a completed booking',
    );
  }

  const isCustomer = booking.customer.toString() === reviewerId;
  const isProvider = booking.serviceProvider.toString() === reviewerId;

  if (!isCustomer && !isProvider) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not part of this booking');
  }

  const receiverId = isCustomer
    ? booking.serviceProvider.toString()
    : booking.customer.toString();

  const existingReview = await Review.findOne({
    bookingId,
    reviewerId,
    isDeleted: false,
  });

  if (existingReview) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'You have already reviewed this booking',
    );
  }

  const review = await Review.create({
    bookingId,
    reviewerId,
    receiverId,
    rating,
    comment,
  });

  await recalculateUserRating(receiverId);

  return review;
};

const getReviewsForUser = async (
  userId: string,
  query: Record<string, unknown>,
) => {

  const reviewQuery = new QueryBuilder(
    Review.find({ receiverId: userId, isDeleted: false }),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await reviewQuery.modelQuery.populate(
    'reviewerId',
    'fullName profileImage',
  );
  const meta = await reviewQuery.countTotal();

  return { meta, result };
};

const getReviewById = async (id: string) => {
  const review = await Review.findOne({ _id: id, isDeleted: false })
    .populate('reviewerId', 'fullName profileImage')
    .populate('receiverId', 'fullName profileImage');

  if (!review) {
    throw new AppError(httpStatus.NOT_FOUND, 'Review not found');
  }

  return review;
};

const updateReview = async (
  id: string,
  reviewerId: string,
  payload: { rating?: number; comment?: string },
) => {
  const review = await Review.findOne({ _id: id, isDeleted: false });

  if (!review) {
    throw new AppError(httpStatus.NOT_FOUND, 'Review not found');
  }

  if (review.reviewerId.toString() !== reviewerId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You can only edit your own review',
    );
  }

  if (payload.rating !== undefined) review.rating = payload.rating;
  if (payload.comment !== undefined) review.comment = payload.comment;

  await review.save();

  if (payload.rating !== undefined) {
    await recalculateUserRating(review.receiverId.toString());
  }

  return review;
};

const deleteReview = async (
  id: string,
  requester: { userId: string; role: string },
) => {
  const review = await Review.findOne({ _id: id, isDeleted: false });

  if (!review) {
    throw new AppError(httpStatus.NOT_FOUND, 'Review not found');
  }

  if (
    requester.role !== 'admin' &&
    review.reviewerId.toString() !== requester.userId
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'You can only delete your own review',
    );
  }

  review.isDeleted = true;
  await review.save();

  await recalculateUserRating(review.receiverId.toString());

  return review;
};

const replyToReview = async (
  id: string,
  requesterId: string,
  comment: string,
) => {
  const review = await Review.findOne({ _id: id, isDeleted: false });

  if (!review) {
    throw new AppError(httpStatus.NOT_FOUND, 'Review not found');
  }

  if (review.receiverId.toString() !== requesterId) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only the reviewed user can reply to this review',
    );
  }

  review.reply = { comment, repliedAt: new Date() };
  await review.save();

  return review;
};

export const reviewService = {
  createReview,
  getReviewsForUser,
  getReviewById,
  updateReview,
  deleteReview,
  replyToReview,
};
