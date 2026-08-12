import httpStatus from 'http-status';
import AppError from '../../error/AppError';
import QueryBuilder from '../../builder/QueryBuilder';
import { Call } from './call.model';
import { TCallStatus, TCallType } from './call.interface';

export interface CreateCallPayload {
  caller: string;
  receiver: string;
  chat?: string;
  type: TCallType;
}

const createCall = async (payload: CreateCallPayload) => {
  return Call.create({
    caller: payload.caller,
    receiver: payload.receiver,
    chat: payload.chat,
    type: payload.type,
    status: 'ringing',
  });
};

const markStatus = async (
  callId: string,
  status: TCallStatus,
  extra: Partial<{ startedAt: Date; endedAt: Date; duration: number }> = {},
) => {
  return Call.findByIdAndUpdate(callId, { status, ...extra }, { new: true });
};

const getCallById = async (id: string, requesterId: string) => {
  const call = await Call.findById(id)
    .populate('caller', 'fullName profileImage')
    .populate('receiver', 'fullName profileImage');

  if (!call) {
    throw new AppError(httpStatus.NOT_FOUND, 'Call not found');
  }

  if (
    call.caller._id.toString() !== requesterId &&
    call.receiver._id.toString() !== requesterId
  ) {
    throw new AppError(httpStatus.FORBIDDEN, 'You cannot access this call');
  }

  return call;
};

const getMyCallHistory = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const callQuery = new QueryBuilder(
    Call.find({ $or: [{ caller: userId }, { receiver: userId }] }),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await callQuery.modelQuery
    .populate('caller', 'fullName profileImage')
    .populate('receiver', 'fullName profileImage');
  const meta = await callQuery.countTotal();
  return { meta, result };
};

export const callService = {
  createCall,
  markStatus,
  getCallById,
  getMyCallHistory,
};
