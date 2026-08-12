import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { callService } from './call.service';

const getMyCallHistory = catchAsync(async (req: Request, res: Response) => {
  const result = await callService.getMyCallHistory(req.user.userId, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    meta: result.meta,
    message: 'Call history fetched successfully',
    data: result.result,
  });
});

const getCallById = catchAsync(async (req: Request, res: Response) => {
  const result = await callService.getCallById(req.params.id, req.user.userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Call fetched successfully',
    data: result,
  });
});

export const callController = {
  getMyCallHistory,
  getCallById,
};
