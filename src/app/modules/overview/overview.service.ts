import { Types } from 'mongoose';
import { User } from '../user/user.models';
import { Booking } from '../booking/booking.model';
import Message from '../message/message.model';
import { MONTH_NAMES, getYearRange, resolveYear } from './overview.utils';
import {
  TMonthlyBookingStats,
  TMonthlyEarningStats,
  TFamilyOverview,
  TProviderOverview,
  TNextBookingSummary,
  TRecentMessageSummary,
  TFavoriteUserSummary,
  TSpendingByCategory,
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

// Shared by the admin (platform-wide) and provider-scoped (extraMatch:
// {serviceProvider}) earning overviews below - same monthly bucketing,
// different $match.
const buildMonthlyEarningStats = async (
  year: number,
  extraMatch: Record<string, unknown> = {},
): Promise<TMonthlyEarningStats[]> => {
  const { yearStart, yearEnd } = getYearRange(year);

  const stats = await Booking.aggregate([
    {
      $match: {
        bookingDate: { $gte: yearStart, $lt: yearEnd },
        status: 'completed',
        ...extraMatch,
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

  return MONTH_NAMES.map((monthName, index) => {
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
};

const getEarningOverview = async (
  yearQuery?: string,
): Promise<{ year: number; monthlyStats: TMonthlyEarningStats[] }> => {
  const year = resolveYear(yearQuery);
  const monthlyStats = await buildMonthlyEarningStats(year);

  return { year, monthlyStats };
};

/**
 * ============================================================
 * FAMILY / PROVIDER "MY DASHBOARD" OVERVIEW
 * ============================================================
 */

// Shape of a User doc once populated+leaned down to just the fields this
// dashboard needs - used for the booking's "other party" and for favorites.
type TPopulatedPartyLean = {
  _id: Types.ObjectId;
  fullName: string;
  profileImage: string;
  role?: string;
  averageRating?: number;
  categoryId?: { _id: Types.ObjectId; name: string } | null;
};

type TNextBookingLean = {
  _id: Types.ObjectId;
  bookingReference: string;
  bookingDate: Date;
  timeSlot: { startTime: string; endTime: string };
  status: string;
  customer?: TPopulatedPartyLean;
  serviceProvider?: TPopulatedPartyLean;
};

// The single confirmed booking with the soonest still-upcoming bookingDate -
// same "confirmed" meaning as everywhere else in this app (see item 1 of the
// booking lifecycle: there's no separate "time arrived" status).
const getNextBooking = async (
  filter: Record<string, unknown>,
  otherPartyField: 'customer' | 'serviceProvider',
): Promise<TNextBookingSummary> => {
  const booking = await Booking.findOne({
    ...filter,
    status: 'confirmed',
    bookingDate: { $gte: new Date() },
  })
    .sort({ bookingDate: 1 })
    .populate({
      path: otherPartyField,
      select: 'fullName profileImage categoryId',
      populate: { path: 'categoryId', select: 'name' },
    })
    .lean<TNextBookingLean | null>();

  if (!booking) {
    return null;
  }

  const otherParty = booking[otherPartyField];

  return {
    _id: booking._id,
    bookingReference: booking.bookingReference,
    bookingDate: booking.bookingDate,
    timeSlot: booking.timeSlot,
    status: booking.status,
    otherParty: otherParty
      ? {
          _id: otherParty._id,
          fullName: otherParty.fullName,
          profileImage: otherParty.profileImage,
          categoryId: otherParty.categoryId ?? null,
        }
      : null,
  };
};

type TMessageLean = {
  _id: Types.ObjectId;
  text: string;
  images?: string[];
  createdAt: Date;
  sender?: TPopulatedPartyLean;
  receiver?: TPopulatedPartyLean;
};

const getRecentMessages = async (userId: string): Promise<TRecentMessageSummary[]> => {
  const messages = await Message.find({
    $or: [{ sender: userId }, { receiver: userId }],
  })
    .sort({ createdAt: -1 })
    .limit(6)
    .populate('sender', 'fullName profileImage')
    .populate('receiver', 'fullName profileImage')
    .lean<TMessageLean[]>();

  return messages.map((message) => ({
    _id: message._id,
    text: message.text,
    images: message.images ?? [],
    createdAt: message.createdAt,
    sender: message.sender
      ? {
          _id: message.sender._id,
          fullName: message.sender.fullName,
          profileImage: message.sender.profileImage,
        }
      : null,
    receiver: message.receiver
      ? {
          _id: message.receiver._id,
          fullName: message.receiver.fullName,
          profileImage: message.receiver.profileImage,
        }
      : null,
  }));
};

// $addToSet (see user.service.ts#addFavoriteUser) appends to the end of the
// array, so the most recently favorited users are the LAST entries.
const getLatestFavoriteUsers = async (userId: string): Promise<TFavoriteUserSummary[]> => {
  const user = await User.findById(userId)
    .select('favoriteUsers')
    .populate({
      path: 'favoriteUsers',
      select: 'fullName profileImage role averageRating categoryId',
      populate: { path: 'categoryId', select: 'name' },
    })
    .lean<{ favoriteUsers?: TPopulatedPartyLean[] } | null>();

  const favorites: TPopulatedPartyLean[] = user?.favoriteUsers ?? [];

  return favorites
    .slice(-3)
    .reverse()
    .map((favorite) => ({
      _id: favorite._id,
      fullName: favorite.fullName,
      profileImage: favorite.profileImage,
      role: favorite.role ?? '',
      averageRating: favorite.averageRating ?? 0,
      categoryId: favorite.categoryId ?? null,
    }));
};

const getSpendingByCategory = async (userId: string): Promise<TSpendingByCategory[]> => {
  const results = await Booking.aggregate([
    { $match: { customer: new Types.ObjectId(userId), status: 'completed' } },
    {
      $lookup: {
        from: 'users',
        localField: 'serviceProvider',
        foreignField: '_id',
        as: 'provider',
      },
    },
    { $unwind: '$provider' },
    {
      $lookup: {
        from: 'categories',
        localField: 'provider.categoryId',
        foreignField: '_id',
        as: 'category',
      },
    },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$category._id',
        categoryName: { $first: { $ifNull: ['$category.name', 'Uncategorized'] } },
        totalSpent: { $sum: '$paymentAmount' },
        bookings: { $sum: 1 },
      },
    },
    { $sort: { totalSpent: -1 } },
  ]);

  return results.map((entry) => ({
    categoryId: entry._id,
    categoryName: entry.categoryName,
    totalSpent: entry.totalSpent,
    bookings: entry.bookings,
  }));
};

const getFamilyOverview = async (userId: string): Promise<TFamilyOverview> => {
  const [statsResult, user, nextBooking, recentMessages, spendingByCategory, latestFavorites] =
    await Promise.all([
      Booking.aggregate([
        { $match: { customer: new Types.ObjectId(userId) } },
        {
          $group: {
            _id: null,
            upcomingBookings: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$status', 'confirmed'] }, { $gte: ['$bookingDate', new Date()] }] },
                  1,
                  0,
                ],
              },
            },
            completedBookings: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
            totalSpent: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$paymentAmount', 0] },
            },
          },
        },
      ]),
      User.findById(userId).select('averageRating').lean<{ averageRating?: number }>(),
      getNextBooking({ customer: userId }, 'serviceProvider'),
      getRecentMessages(userId),
      getSpendingByCategory(userId),
      getLatestFavoriteUsers(userId),
    ]);

  const stats = statsResult[0];

  return {
    stats: {
      upcomingBookings: stats?.upcomingBookings ?? 0,
      completedBookings: stats?.completedBookings ?? 0,
      averageRating: user?.averageRating ?? 0,
      totalSpent: stats?.totalSpent ?? 0,
    },
    nextBooking,
    recentMessages,
    spendingByCategory,
    latestFavorites,
  };
};

const getProviderOverview = async (
  userId: string,
  yearQuery?: string,
): Promise<TProviderOverview> => {
  const year = resolveYear(yearQuery);

  const startOfYear = new Date(year, 0, 1);
  const startOfNextYear = new Date(year + 1, 0, 1);

  const [statsResult, user, nextBooking, recentMessages, monthlyStats, calendarBookings] =
    await Promise.all([
      Booking.aggregate([
        {
          $match: {
            serviceProvider: new Types.ObjectId(userId),
          },
        },
        {
          $group: {
            _id: null,

            upcomingBookings: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$status', 'confirmed'] },
                      { $gte: ['$bookingDate', new Date()] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            completedBookings: {
              $sum: {
                $cond: [{ $eq: ['$status', 'completed'] }, 1, 0],
              },
            },

            earnings: {
              $sum: {
                $cond: [
                  { $eq: ['$status', 'completed'] },
                  '$providerEarning',
                  0,
                ],
              },
            },
          },
        },
      ]),

      User.findById(userId)
        .select('averageRating')
        .lean<{ averageRating?: number }>(),

      getNextBooking(
        { serviceProvider: userId },
        'customer',
      ),

      getRecentMessages(userId),

      buildMonthlyEarningStats(year, {
        serviceProvider: new Types.ObjectId(userId),
      }),

      // All confirmed bookings for the calendar
      Booking.find({
        serviceProvider: new Types.ObjectId(userId),
        status: 'confirmed',
        bookingDate: {
          $gte: startOfYear,
          $lt: startOfNextYear,
        },
      })
        .populate({
          path: 'customer',
          select: 'name firstName lastName profileImage',
        })
        .sort({ bookingDate: 1 })
        .lean(),
    ]);

  const stats = statsResult[0];

  return {
    stats: {
      upcomingBookings: stats?.upcomingBookings ?? 0,
      completedBookings: stats?.completedBookings ?? 0,
      earnings: stats?.earnings ?? 0,
      averageRating: user?.averageRating ?? 0,
    },

    nextBooking,

    recentMessages,

    earningOverview: {
      year,
      monthlyStats,
    },

    calendarBookings,
  };
};

const getMyOverview = async (
  userId: string,
  role: string,
  query: Record<string, unknown>,
): Promise<TFamilyOverview | TProviderOverview> => {
  if (role === 'provider') {
    return getProviderOverview(userId, query.year as string | undefined);
  }

  return getFamilyOverview(userId);
};

export const overviewService = {
  getTotalOverview,
  getBookingOverview,
  getEarningOverview,
  getMyOverview,
};
