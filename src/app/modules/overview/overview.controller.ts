import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { overviewService } from './overview.service';

const getTotalOverview = catchAsync(async (req: Request, res: Response) => {
  const result = await overviewService.getTotalOverview();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Overview fetched successfully',
    data: result,
  });
});


const getBookingOverview = catchAsync(async (req: Request, res: Response) => {
  const result = await overviewService.getBookingOverview(
    req.query.year as string | undefined,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Booking overview fetched successfully',
    data: result,
  });
});

const getEarningOverview = catchAsync(async (req: Request, res: Response) => {
  const result = await overviewService.getEarningOverview(
    req.query.year as string | undefined,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Earnings overview fetched successfully',
    data: result,
  });
});

export const overviewController = {
  getTotalOverview,
  getBookingOverview,
  getEarningOverview,
};
