import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { reviewService } from './review.service';

const createReview = catchAsync(async (req: Request, res: Response) => {
  const result = await reviewService.createReview(req.user.userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Review submitted successfully',
    data: result,
  });
});

const getReviewsForUser = catchAsync(async (req: Request, res: Response) => {
  const result = await reviewService.getReviewsForUser(
    req.params.userId,
    req.query,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    meta: result.meta,
    message: 'Reviews fetched successfully',
    data: result.result,
  });
});

const getMyReviews = catchAsync(async (req: Request, res: Response) => {
  const result = await reviewService.getMyWrittenReviews(
    req.user.userId,
    req.query,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    meta: result.meta,
    message: 'Reviews fetched successfully',
    data: result.result,
  });
});

const getReviewsByBookingId = catchAsync(async (req: Request, res: Response) => {
  const result = await reviewService.getReviewsByBookingId(req.params.bookingId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Reviews fetched successfully',
    data: result,
  });
});

const getReviewById = catchAsync(async (req: Request, res: Response) => {
  const result = await reviewService.getReviewById(req.params.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Review fetched successfully',
    data: result,
  });
});

const updateReview = catchAsync(async (req: Request, res: Response) => {
  const result = await reviewService.updateReview(
    req.params.id,
    req.user.userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Review updated successfully',
    data: result,
  });
});

const deleteReview = catchAsync(async (req: Request, res: Response) => {
  const result = await reviewService.deleteReview(req.params.id, {
    userId: req.user.userId,
    role: req.user.role,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Review deleted successfully',
    data: result,
  });
});

const replyToReview = catchAsync(async (req: Request, res: Response) => {
  const result = await reviewService.replyToReview(
    req.params.id,
    req.user.userId,
    req.body.comment,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Reply added successfully',
    data: result,
  });
});

export const reviewController = {
  createReview,
  getReviewsForUser,
  getMyReviews,
  getReviewsByBookingId,
  getReviewById,
  updateReview,
  deleteReview,
  replyToReview,
};
