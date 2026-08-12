import { Model } from 'mongoose';

export const CATEGORY_STATUS = ['active', 'inactive', 'coming_soon'] as const;

export type TCategoryStatus = (typeof CATEGORY_STATUS)[number];

export interface TCategory {
  order: number;
  name: string;
  description?: string;
  icon?: string;
  image?: string;
  status: TCategoryStatus;
  isDeleted: boolean;
}

export type CategoryModel = Model<TCategory>;
