import { Request, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { availabilityService } from './availability.service';
import { TWeekDay } from './availability.interface';

const getMyAvailability = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user;
  const result = await availabilityService.getMyAvailability(userId);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'Availability fetched successfully',
    data: result,
  });
});

const toggleDayAvailability = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user;
  const { day } = req.params;
  const { isAvailable } = req.body;

  const result = await availabilityService.toggleDayAvailability(
    userId,
    day as TWeekDay,
    isAvailable,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: `Availability for ${day} updated successfully`,
    data: result,
  });
});

const addTimeSlot = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user;
  const { day } = req.params;
  const { startTime, endTime } = req.body;

  const result = await availabilityService.addTimeSlot(
    userId,
    day as TWeekDay,
    startTime,
    endTime,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.CREATED,
    message: 'Time slot added successfully',
    data: result,
  });
});

const updateTimeSlot = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user;
  const { day, slotId } = req.params;
  const { startTime, endTime } = req.body;

  const result = await availabilityService.updateTimeSlot(
    userId,
    day as TWeekDay,
    slotId,
    startTime,
    endTime,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'Time slot updated successfully',
    data: result,
  });
});

const deleteTimeSlot = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user;
  const { day, slotId } = req.params;

  const result = await availabilityService.deleteTimeSlot(
    userId,
    day as TWeekDay,
    slotId,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'Time slot deleted successfully',
    data: result,
  });
});

const updateBookingRules = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.user;

  const result = await availabilityService.updateBookingRules(userId, req.body);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'Booking rules updated successfully',
    data: result,
  });
});

export const availabilityController = {
  getMyAvailability,
  toggleDayAvailability,
  addTimeSlot,
  updateTimeSlot,
  deleteTimeSlot,
  updateBookingRules,
};
