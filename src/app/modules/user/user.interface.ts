import { Model, Schema, Types } from 'mongoose';


export type TLocation = {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
};

export interface TUserCreate {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email: string;
  password: string;
  profileImage: string;
  role: string;
  phone?: string;
  city?: string;
  postalCode?: string;
  address?: string;
  referralSource?: string;
  dateOfBirth?: Date | string;
  categoryId?: Types.ObjectId | string;
  category?: string;
  hourlyRate?: number;
  experience?: number;
  lenguages?: string[];
  totalReview?: number;
  averageRating?: number;
  providerProfileId?: string;
  location?: TLocation;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  favoriteUsers?: Types.ObjectId[] | string[];
  status: string;
  isDeleted: boolean;
}

export interface TUser extends TUserCreate {
  _id: string;
}

export interface DeleteAccountPayload {
  password: string;
}

export interface UserModel extends Model<TUser> {
  isUserExist(email: string): Promise<TUser>;
  
  isUserActive(email: string): Promise<TUser>;

  IsUserExistById(id: string): Promise<TUser>;

  isPasswordMatched(
    plainTextPassword: string,
    hashedPassword: string,
  ): Promise<boolean>;
}

export type IPaginationOption = {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};
