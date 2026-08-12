import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { reportService } from './report.service';

const createReport = catchAsync(async (req: Request, res: Response) => {
  const result = await reportService.createReport(req.user.userId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Report submitted successfully',
    data: result,
  });
});

const getMyReports = catchAsync(async (req: Request, res: Response) => {
  const result = await reportService.getMyReports(req.user.userId, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    meta: result.meta,
    message: 'Reports fetched successfully',
    data: result.result,
  });
});

const getAllReports = catchAsync(async (req: Request, res: Response) => {
  const result = await reportService.getAllReports(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    meta: result.meta,
    message: 'Reports fetched successfully',
    data: result.result,
  });
});

const getReportById = catchAsync(async (req: Request, res: Response) => {
  const result = await reportService.getReportById(req.params.id, {
    userId: req.user.userId,
    role: req.user.role,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Report fetched successfully',
    data: result,
  });
});

const updateReportStatus = catchAsync(async (req: Request, res: Response) => {
  const result = await reportService.updateReportStatus(
    req.params.id,
    req.user.userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Report status updated successfully',
    data: result,
  });
});

const deleteReport = catchAsync(async (req: Request, res: Response) => {
  const result = await reportService.deleteReport(req.params.id, {
    userId: req.user.userId,
    role: req.user.role,
  });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Report deleted successfully',
    data: result,
  });
});

export const reportController = {
  createReport,
  getMyReports,
  getAllReports,
  getReportById,
  updateReportStatus,
  deleteReport,
};
