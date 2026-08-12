import { Types } from 'mongoose';

export type TCallType = 'audio' | 'video';

export type TCallStatus =
  | 'ringing'
  | 'ongoing'
  | 'completed'
  | 'missed'
  | 'rejected'
  | 'cancelled'
  | 'failed';

export interface ICall {
  chat?: Types.ObjectId;
  caller: Types.ObjectId;
  receiver: Types.ObjectId;
  type: TCallType;
  status: TCallStatus;
  startedAt?: Date;
  endedAt?: Date;
  duration: number; // connected duration, in seconds
}
