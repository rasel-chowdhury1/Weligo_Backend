import httpStatus from 'http-status';
import { Types } from 'mongoose';
import AppError from '../../error/AppError';
import QueryBuilder from '../../builder/QueryBuilder';
import { SupportTicket } from './support.model';
import { SupportTicketStatus, SupportTicketSubject } from './support.interface';

export interface CreateSupportTicketPayload {
  subject: SupportTicketSubject;
  title: string;
  description: string;
  attachment?: string;
}

export interface TicketRequester {
  userId: string;
  role: string;
}

const createTicket = async (
  userId: string,
  payload: CreateSupportTicketPayload,
) => {
  const { subject, title, description, attachment } = payload;

  const ticket = await SupportTicket.create({
    user: userId,
    subject,
    title,
    description,
    messages: [
      {
        sender: userId,
        message: description,
        attachment,
      },
    ],
  });

  return ticket;
};

const getMyTickets = async (userId: string, query: Record<string, unknown>) => {
  const ticketQuery = new QueryBuilder(
    SupportTicket.find({ user: userId }),
    query,
  )
    .search(['title', 'ticketNumber'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await ticketQuery.modelQuery;
  const meta = await ticketQuery.countTotal();
  return { meta, result };
};

const getAllTickets = async (query: Record<string, unknown>) => {
  const ticketQuery = new QueryBuilder(SupportTicket.find(), query)
    .search(['title', 'ticketNumber'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await ticketQuery.modelQuery.populate(
    'user',
    'fullName email profileImage role',
  );
  const meta = await ticketQuery.countTotal();
  return { meta, result };
};

const getTicketById = async (id: string, requester: TicketRequester) => {
  const ticket = await SupportTicket.findById(id).populate(
    'user',
    'fullName email profileImage role',
  );

  if (!ticket) {
    throw new AppError(httpStatus.NOT_FOUND, 'Support ticket not found');
  }

  if (
    requester.role !== 'admin' &&
    ticket.user._id.toString() !== requester.userId
  ) {
    throw new AppError(httpStatus.FORBIDDEN, 'You cannot access this ticket');
  }

  return ticket;
};

const addMessage = async (
  id: string,
  requester: TicketRequester,
  payload: { message: string; attachment?: string },
) => {
  const ticket = await SupportTicket.findById(id);

  if (!ticket) {
    throw new AppError(httpStatus.NOT_FOUND, 'Support ticket not found');
  }

  if (
    requester.role !== 'admin' &&
    ticket.user.toString() !== requester.userId
  ) {
    throw new AppError(httpStatus.FORBIDDEN, 'You cannot reply to this ticket');
  }

  if (ticket.status === SupportTicketStatus.CLOSED) {
    throw new AppError(httpStatus.BAD_REQUEST, 'This ticket is closed');
  }

  ticket.messages.push({
    sender: new Types.ObjectId(requester.userId),
    message: payload.message,
    attachment: payload.attachment,
  });

  if (ticket.status === SupportTicketStatus.OPEN) {
    ticket.status = SupportTicketStatus.IN_PROGRESS;
  }

  await ticket.save();
  return ticket;
};

const updateStatus = async (id: string, status: SupportTicketStatus) => {
  const updateData: Record<string, unknown> = { status };

  if (
    status === SupportTicketStatus.RESOLVED ||
    status === SupportTicketStatus.CLOSED
  ) {
    updateData.resolvedAt = new Date();
  }

  const ticket = await SupportTicket.findByIdAndUpdate(id, updateData, {
    new: true,
  });

  if (!ticket) {
    throw new AppError(httpStatus.NOT_FOUND, 'Support ticket not found');
  }

  return ticket;
};

export const supportService = {
  createTicket,
  getMyTickets,
  getAllTickets,
  getTicketById,
  addMessage,
  updateStatus,
};
