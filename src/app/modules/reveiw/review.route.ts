import { Router } from 'express';
import auth from '../../middleware/auth';
import validateRequest from '../../middleware/validateRequest';
import { USER_ROLE } from '../user/user.constants';
import { reviewController } from './review.controller';
import { reviewValidation } from './review.validation';

export const reviewRoutes = Router();

reviewRoutes
  .post(
    '/create',
    auth(USER_ROLE.FAMILY, USER_ROLE.PROVIDER),
    validateRequest(reviewValidation.createReviewZodSchema),
    reviewController.createReview,
  )

  .get(
    '/my-reviews',
    auth(USER_ROLE.FAMILY, USER_ROLE.PROVIDER, USER_ROLE.ADMIN),
    reviewController.getMyReviews,
  )

  .get('/user/:userId', reviewController.getReviewsForUser)

  .get('/booking/:bookingId', reviewController.getReviewsByBookingId)

  .get('/:id', reviewController.getReviewById)

  .patch(
    '/:id',
    auth(USER_ROLE.FAMILY, USER_ROLE.PROVIDER),
    validateRequest(reviewValidation.updateReviewZodSchema),
    reviewController.updateReview,
  )

  .patch(
    '/:id/reply',
    auth(USER_ROLE.FAMILY, USER_ROLE.PROVIDER),
    validateRequest(reviewValidation.replyToReviewZodSchema),
    reviewController.replyToReview,
  )

  .delete(
    '/:id',
    auth(USER_ROLE.FAMILY, USER_ROLE.PROVIDER, USER_ROLE.ADMIN),
    reviewController.deleteReview,
  );
