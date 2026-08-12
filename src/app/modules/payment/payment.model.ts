import { Schema, model } from 'mongoose';
import {
  PaymentModel,
  TPayment,
  PAYMENT_STATUSES,
  CURRENCIES,
} from './payment.interface';
import { PAYMENT_METHODS } from '../booking/booking.interface';

const PaymentSchema = new Schema<TPayment, PaymentModel>(
  {
    booking: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },

    payer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    commissionAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    providerEarning: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      enum: CURRENCIES,
      default: 'CHF',
    },

    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'pending',
    },

    transactionId: {
      type: String,
    },

    gatewayReference: {
      type: String,
    },

    authorizedAt: {
      type: Date,
    },

    capturedAt: {
      type: Date,
    },

    refundedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    refundReason: {
      type: String,
      trim: true,
    },

    failureReason: {
      type: String,
      trim: true,
    },

    gatewayResponse: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

PaymentSchema.index({ booking: 1 });
PaymentSchema.index({ transactionId: 1 });

export const Payment = model<TPayment, PaymentModel>('Payment', PaymentSchema);

export default Payment;