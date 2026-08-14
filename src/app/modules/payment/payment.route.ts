import express from 'express';
import { paymentController } from './payment.controller';
// import auth from '../../middlewares/auth'; // wire up your real auth middleware here

const router = express.Router();

// Datatrans posts here. No auth middleware - it's authenticated by the
// Datatrans-Signature header instead (verified inside paymentService.handlePaymentWebhook)
router.post('/webhook', paymentController.handleWebhook);

// Stripe posts here. No auth middleware - it's authenticated by the
// Stripe-Signature header instead (verified inside paymentService.handleStripeWebhookEvent)
router.post('/stripe/webhook', paymentController.handleStripeWebhook);

router.get('/:paymentId', /* auth('admin', 'provider'), */ paymentController.getPayment);

router.get(
  '/booking/:bookingId',
  /* auth('customer', 'provider', 'admin'), */
  paymentController.getPaymentByBooking
);

router.post('/:paymentId/refund', /* auth('admin'), */ paymentController.refundPayment);

export const paymentRoutes = router;