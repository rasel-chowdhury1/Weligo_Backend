import { Types } from "mongoose";

export interface IFeedback {
  userId: Types.ObjectId;
  text: string;
  rating: number;
  adminVerified: string;
  isDeleted?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUpdateFeedback {
  text?: string;
  rating?: number;
}
