import httpStatus from 'http-status';
import AppError from '../../error/AppError';
import QueryBuilder from '../../builder/QueryBuilder';
import { Category } from './category.model';
import { TCategory } from './category.interface';
import { User } from '../user/user.models';

const createCategory = async (payload: Partial<TCategory>) => {
  const category = await Category.create(payload);
  return category;
};

const getAllCategories = async (query: Record<string, unknown>) => {
  const categoryQuery = new QueryBuilder(Category.find(), {
    sort: 'order',
    ...query,
  })
    .search(['name'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await categoryQuery.modelQuery;
  const meta = await categoryQuery.countTotal();
  return { meta, result };
};

const getAllCategoriesWithProviderStats = async (
  query: Record<string, unknown>,
) => {
  const categoryQuery = new QueryBuilder(Category.find(), {
    sort: 'order',
    ...query,
  })
    .search(['name'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await categoryQuery.modelQuery;
  const meta = await categoryQuery.countTotal();

  const categoryIds = result.map((cat) => cat._id);

  // Aggregate provider count + min hourly rate, grouped by categoryId
  const providerStats = await User.aggregate([
    {
      $match: {
        role: 'provider',
        categoryId: { $in: categoryIds },
        status: 'active',
        approvalStatus: 'approved',
        // isDeleted already excluded by User's pre('aggregate') hook
      },
    },
    {
      $group: {
        _id: '$categoryId',
        totalProviders: { $sum: 1 },
        minimumStartingHourlyRate: { $min: '$hourlyRate' },
      },
    },
  ]);

  const statsMap = new Map(
    providerStats.map((stat) => [stat._id.toString(), stat]),
  );

  const resultWithStats = result.map((category) => {
    const stats = statsMap.get(category._id.toString());
    return {
      ...category.toObject(),
      totalProviders: stats?.totalProviders ?? 0,
      minimumStartingHourlyRate: stats?.minimumStartingHourlyRate ?? 0,
    };
  });

  return { meta, result: resultWithStats };
};

const getCategoryById = async (id: string) => {
  const category = await Category.findById(id);

  if (!category) {
    throw new AppError(httpStatus.NOT_FOUND, 'Category not found');
  }

  return category;
};

const updateCategory = async (id: string, payload: Partial<TCategory>) => {
  // keep the existing icon/image when a new file isn't uploaded
  if (!payload.icon) {
    delete payload.icon;
  }
  if (!payload.image) {
    delete payload.image;
  }

  const category = await Category.findByIdAndUpdate(id, payload, {
    new: true,
  });

  if (!category) {
    throw new AppError(httpStatus.NOT_FOUND, 'Category not found');
  }

  return category;
};

const deleteCategory = async (id: string) => {
  const category = await Category.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { new: true },
  );

  if (!category) {
    throw new AppError(httpStatus.NOT_FOUND, 'Category not found');
  }

  return category;
};

export const categoryService = {
  createCategory,
  getAllCategories,
  getAllCategoriesWithProviderStats,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
