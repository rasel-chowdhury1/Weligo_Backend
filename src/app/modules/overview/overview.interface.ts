import { Types } from 'mongoose';

export type TPendingProvider = {
  _id: Types.ObjectId;
  fullName: string;
  email: string;
  phone: string;
  profileImage: string;
  city: string;
  address: string;
  categoryId: {
    _id: Types.ObjectId;
    name: string;
  } | null;
  hourlyRate: number;
  experience: number;
  createdAt: Date;
  approvalStatus: 'pending';
};

export type TTotalOverview = {
  totalFamilies: number;
  totalProviders: number;
  totalActiveBookings: number;
  totalRevenue: number;
  totalPendingProviderApprovals: number;
  pendingProviders: TPendingProvider[];
};

export type TMonthlyBookingStats = {
  month: number; // 1-12
  monthName: string;
  pending: number;
  confirmed: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  noShow: number;
  total: number;
};

export type TMonthlyEarningStats = {
  month: number; // 1-12
  monthName: string;
  totalCustomerPayment: number;
  totalCommission: number;
  totalProviderEarning: number;
};

/**
 * ============================================================
 * FAMILY / PROVIDER "MY DASHBOARD" OVERVIEW
 * ============================================================
 */

export type TOtherPartySummary = {
  _id: Types.ObjectId;
  fullName: string;
  profileImage: string;
  categoryId?: { _id: Types.ObjectId; name: string } | null;
};

export type TNextBookingSummary = {
  _id: Types.ObjectId;
  bookingReference: string;
  bookingDate: Date;
  timeSlot: { startTime: string; endTime: string };
  status: string;
  otherParty: TOtherPartySummary | null;
} | null;

export type TRecentMessageSummary = {
  _id: Types.ObjectId;
  text: string;
  images: string[];
  createdAt: Date;
  sender: { _id: Types.ObjectId; fullName: string; profileImage: string } | null;
  receiver: { _id: Types.ObjectId; fullName: string; profileImage: string } | null;
};

export type TFavoriteUserSummary = {
  _id: Types.ObjectId;
  fullName: string;
  profileImage: string;
  role: string;
  averageRating: number;
  categoryId?: { _id: Types.ObjectId; name: string } | null;
};

export type TSpendingByCategory = {
  categoryId: Types.ObjectId | null;
  categoryName: string;
  totalSpent: number;
  bookings: number;
};

export type TFamilyOverview = {
  stats: {
    upcomingBookings: number;
    completedBookings: number;
    averageRating: number;
    totalSpent: number;
  };
  nextBooking: TNextBookingSummary;
  recentMessages: TRecentMessageSummary[];
  spendingByCategory: TSpendingByCategory[];
  latestFavorites: TFavoriteUserSummary[];
};

export type TProviderOverview = {
  stats: {
    upcomingBookings: number;
    completedBookings: number;
    earnings: number;
    averageRating: number;
  };
  nextBooking: TNextBookingSummary;
  recentMessages: TRecentMessageSummary[];
  earningOverview: { year: number; monthlyStats: TMonthlyEarningStats[] };
  calendarBookings: any;
};
