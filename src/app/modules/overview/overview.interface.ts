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
