import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { storeFile } from '../../utils/fileHelper';
import { supportService } from './support.service';

const createTicket = catchAsync(async (req: Request, res: Response) => {
  if (req.file) {
    req.body.attachment = storeFile('support', req.file.filename);
  }

  const result = await supportService.createTicket(req.user.userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Support ticket created successfully',
    data: result,
  });
});

const getMyTickets = catchAsync(async (req: Request, res: Response) => {
  const result = await supportService.getMyTickets(req.user.userId, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    meta: result.meta,
    message: 'My support tickets fetched successfully',
    data: result.result,
  });
});

const getAllTickets = catchAsync(async (req: Request, res: Response) => {
  const result = await supportService.getAllTickets(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    meta: result.meta,
    message: 'Support tickets fetched successfully',
    data: result.result,
  });
});

const getTicketById = catchAsync(async (req: Request, res: Response) => {
  const result = await supportService.getTicketById(req.params.id, {
    userId: req.user.userId,
    role: req.user.role,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Support ticket fetched successfully',
    data: result,
  });
});

const addMessage = catchAsync(async (req: Request, res: Response) => {
  if (req.file) {
    req.body.attachment = storeFile('support', req.file.filename);
  }

  const result = await supportService.addMessage(
    req.params.id,
    { userId: req.user.userId, role: req.user.role },
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Message added successfully',
    data: result,
  });
});

const updateStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await supportService.updateStatus(
    req.params.id,
    req.body.status,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Support ticket status updated successfully',
    data: result,
  });
});

export const supportController = {
  createTicket,
  getMyTickets,
  getAllTickets,
  getTicketById,
  addMessage,
  updateStatus,
};
