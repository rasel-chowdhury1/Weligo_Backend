import { Schema, model } from 'mongoose';
import { ICall } from './call.interface';

const CallSchema = new Schema<ICall>(
  {
    chat: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
    },
    caller: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['audio', 'video'],
      required: true,
    },
    status: {
      type: String,
      enum: [
        'ringing',
        'ongoing',
        'completed',
        'missed',
        'rejected',
        'cancelled',
        'failed',
      ],
      default: 'ringing',
    },
    startedAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
    duration: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

CallSchema.index({ caller: 1, createdAt: -1 });
CallSchema.index({ receiver: 1, createdAt: -1 });

export const Call = model<ICall>('Call', CallSchema);
export default Call;
