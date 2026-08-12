import httpStatus from 'http-status';
import AppError from '../../error/AppError';
import QueryBuilder from '../../builder/QueryBuilder';
import { Report } from './report.model';
import { Booking } from '../booking/booking.model';
import { TReportStatus } from './report.interface';

export type TCreateReportPayload = {
  bookingId: string;
  reason: string;
  description?: string;
};

const createReport = async (reporterId: string, payload: TCreateReportPayload) => {
  const { bookingId, reason, description } = payload;

  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new AppError(httpStatus.NOT_FOUND, 'Booking not found');
  }

  const isCustomer = booking.customer.toString() === reporterId;
  const isProvider = booking.serviceProvider.toString() === reporterId;

  if (!isCustomer && !isProvider) {
    throw new AppError(httpStatus.FORBIDDEN, 'You are not part of this booking');
  }

  
  const reportedUserId = isCustomer
    ? booking.serviceProvider.toString()
    : booking.customer.toString();

    
  const otherPartyId = isCustomer
    ? booking.serviceProvider.toString()
    : booking.customer.toString();

  if (reportedUserId !== otherPartyId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'reportedUserId must be the other party on this booking',
    );
  }


  const report = await Report.create({
    bookingId,
    reporterId,
    reportedUserId,
    reason,
    description,
  });

  return report;
};

const getMyReports = async (reporterId: string, query: Record<string, unknown>) => {
  const reportQuery = new QueryBuilder(
    Report.find({ reporterId, isDeleted: false }),
    query,
  )
    .search(['reason', 'description'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await reportQuery.modelQuery.populate(
    'reportedUserId',
    'fullName profileImage email',
  );
  const meta = await reportQuery.countTotal();

  return { meta, result };
};

const getAllReports = async (query: Record<string, unknown>) => {
  const reportQuery = new QueryBuilder(
    Report.find({ isDeleted: false }),
    query,
  )
    .search(['reason', 'description'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await reportQuery.modelQuery
    .populate('reporterId', 'fullName profileImage email')
    .populate('reportedUserId', 'fullName profileImage email')
    .populate('bookingId');
  const meta = await reportQuery.countTotal();

  return { meta, result };
};

const getReportById = async (id: string, requester: { userId: string; role: string }) => {
  const report = await Report.findOne({ _id: id, isDeleted: false })
    .populate('reporterId', 'fullName profileImage email')
    .populate('reportedUserId', 'fullName profileImage email')
    .populate('bookingId');

  if (!report) {
    throw new AppError(httpStatus.NOT_FOUND, 'Report not found');
  }

  if (
    requester.role !== 'admin' &&
    report.reporterId._id.toString() !== requester.userId
  ) {
    throw new AppError(httpStatus.FORBIDDEN, 'You cannot access this report');
  }

  return report;
};

const updateReportStatus = async (
  id: string,
  adminId: string,
  payload: { status: TReportStatus; adminNote?: string },
) => {
  const report = await Report.findOne({ _id: id, isDeleted: false });

  if (!report) {
    throw new AppError(httpStatus.NOT_FOUND, 'Report not found');
  }

  report.status = payload.status;
  if (payload.adminNote !== undefined) report.adminNote = payload.adminNote;

  if (payload.status === 'resolved' || payload.status === 'rejected') {
    report.resolvedAt = new Date();
    report.resolvedBy = adminId as unknown as typeof report.resolvedBy;
  }

  await report.save();

  return report;
};

const deleteReport = async (id: string, requester: { userId: string; role: string }) => {
  const report = await Report.findOne({ _id: id, isDeleted: false });

  if (!report) {
    throw new AppError(httpStatus.NOT_FOUND, 'Report not found');
  }

  if (
    requester.role !== 'admin' &&
    report.reporterId.toString() !== requester.userId
  ) {
    throw new AppError(httpStatus.FORBIDDEN, 'You can only delete your own report');
  }

  report.isDeleted = true;
  await report.save();

  return report;
};

export const reportService = {
  createReport,
  getMyReports,
  getAllReports,
  getReportById,
  updateReportStatus,
  deleteReport,
};
