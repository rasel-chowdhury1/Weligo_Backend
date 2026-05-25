import { Model, Schema } from 'mongoose';


export interface TUserCreate {
  fullName?: string;
  email: string;
  password: string;
  profileImage: string;
  role: string;
  phone?: string;
  address?: string;
  about?: string;
  dateOfBirth?: Date;
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
