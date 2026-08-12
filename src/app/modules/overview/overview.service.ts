import { User } from '../user/user.models';
import { Booking } from '../booking/booking.model';
import { MONTH_NAMES, getYearRange, resolveYear } from './overview.utils';
import {
  TMonthlyBookingStats,
  TMonthlyEarningStats,
  TTotalOverview,
} from './overview.interface';

const getTotalOverview = async () => {
  const [
    totalFamilies,
    totalProviders,
    totalActiveBookings,
    totalPendingProviderApprovals,
    revenueResult,
    pendingProviders,
  ] = await Promise.all([
    User.countDocuments({
      role: 'family',
    }),

    User.countDocuments({
      role: 'provider',
    }),

    Booking.countDocuments({
      status: {
        $in: ['pending', 'confirmed', 'inprogress'],
      },
    }),

    User.countDocuments({
      role: 'provider',
      approvalStatus: 'pending',
    }),

    Booking.aggregate([
      {
        $match: {
          status: 'completed',
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: '$paymentAmount',
          },
        },
      },
    ]),

    User.find({
      role: 'provider',
      approvalStatus: 'pending',
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select(
        'fullName email phone profileImage city address categoryId hourlyRate experience createdAt approvalStatus',
      )
      .populate('categoryId', 'name')
      .lean(),
  ]);

  return {
    totalFamilies,
    totalProviders,
    totalActiveBookings,
    totalRevenue: revenueResult[0]?.totalRevenue ?? 0,
    totalPendingProviderApprovals,
    pendingProviders,
  };
};

// "confirmed" bookings are split into confirmed (upcoming/overdue) vs inProgress
// (bookingDate falls on today) using the same today-window rule as
// booking.service.ts#getMyBookings, so the two stay consistent across the app.
const getBookingOverview = async (
  yearQuery?: string,
): Promise<{ year: number; monthlyStats: TMonthlyBookingStats[] }> => {
  const year = resolveYear(yearQuery);
  const { yearStart, yearEnd } = getYearRange(year);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const stats = await Booking.aggregate([
    { $match: { bookingDate: { $gte: yearStart, $lt: yearEnd } } },
    {
      $group: {
        _id: { $month: '$bookingDate' },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        confirmed: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'confirmed'] },
                  {
                    $not: [
                      {
                        $and: [
                          { $gte: ['$bookingDate', startOfToday] },
                          { $lt: ['$bookingDate', startOfTomorrow] },
                        ],
                      },
                    ],
                  },
                ],
              },
              1,
              0,
            ],
          },
        },
        inProgress: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'confirmed'] },
                  { $gte: ['$bookingDate', startOfToday] },
                  { $lt: ['$bookingDate', startOfTomorrow] },
                ],
              },
              1,
              0,
            ],
          },
        },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        noShow: { $sum: { $cond: [{ $eq: ['$status', 'no-show'] }, 1, 0] } },
        total: { $sum: 1 },
      },
    },
  ]);

  const statsByMonth = new Map(stats.map((entry) => [entry._id, entry]));

  const monthlyStats: TMonthlyBookingStats[] = MONTH_NAMES.map((monthName, index) => {
    const month = index + 1;
    const entry = statsByMonth.get(month);

    return {
      month,
      monthName,
      pending: entry?.pending ?? 0,
      confirmed: entry?.confirmed ?? 0,
      inProgress: entry?.inProgress ?? 0,
      completed: entry?.completed ?? 0,
      cancelled: entry?.cancelled ?? 0,
      noShow: entry?.noShow ?? 0,
      total: entry?.total ?? 0,
    };
  });

  return { year, monthlyStats };
};

const getEarningOverview = async (
  yearQuery?: string,
): Promise<{ year: number; monthlyStats: TMonthlyEarningStats[] }> => {
  const year = resolveYear(yearQuery);
  const { yearStart, yearEnd } = getYearRange(year);

  const stats = await Booking.aggregate([
    {
      $match: {
        bookingDate: { $gte: yearStart, $lt: yearEnd },
        status: 'completed',
      },
    },
    {
      $group: {
        _id: { $month: '$bookingDate' },
        totalCustomerPayment: { $sum: '$paymentAmount' },
        totalCommission: { $sum: '$commissionAmount' },
        totalProviderEarning: { $sum: '$providerEarning' },
      },
    },
  ]);

  const statsByMonth = new Map(stats.map((entry) => [entry._id, entry]));

  const monthlyStats: TMonthlyEarningStats[] = MONTH_NAMES.map((monthName, index) => {
    const month = index + 1;
    const entry = statsByMonth.get(month);

    return {
      month,
      monthName,
      totalCustomerPayment: entry?.totalCustomerPayment ?? 0,
      totalCommission: entry?.totalCommission ?? 0,
      totalProviderEarning: entry?.totalProviderEarning ?? 0,
    };
  });

  return { year, monthlyStats };
};

export const overviewService = {
  getTotalOverview,
  getBookingOverview,
  getEarningOverview,
};
