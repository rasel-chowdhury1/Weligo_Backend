import { Request, RequestHandler, Response } from 'express';
import httpStatus from 'http-status';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { storeFile } from '../../utils/fileHelper';
import { categoryService } from './category.service';

const attachUploadedFiles = (req: Request) => {
  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;

  return {
    ...req.body,
    ...(files?.icon?.[0] && {
      icon: storeFile("category", files.icon[0].filename),
    }),
    ...(files?.image?.[0] && {
      image: storeFile("category", files.image[0].filename),
    }),
  };
};

const createCategory = catchAsync(async (req: Request, res: Response) => {
  const payload = attachUploadedFiles(req);

  const result = await categoryService.createCategory(payload);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Category created successfully",
    data: result,
  });
});

const getAllCategories = catchAsync(async (req: Request, res: Response) => {
  const result = await categoryService.getAllCategories(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    meta: result.meta,
    message: 'Categories fetched successfully',
    data: result.result,
  });
});

const getCategoryById = catchAsync(async (req: Request, res: Response) => {
  const result = await categoryService.getCategoryById(req.params.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Category fetched successfully',
    data: result,
  });
});


const getAllCategoriesWithProviderStats: RequestHandler = catchAsync(
  async (req, res) => {
    const result = await categoryService.getAllCategoriesWithProviderStats(
      req.query,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Categories with provider stats retrieved successfully',
      meta: result.meta,
      data: result.result,
    });
  },
);

const updateCategory = catchAsync(async (req: Request, res: Response) => {
  const payload = attachUploadedFiles(req);

  const result = await categoryService.updateCategory(
    req.params.id,
    payload
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Category updated successfully",
    data: result,
  });
});

const deleteCategory = catchAsync(async (req: Request, res: Response) => {
  const result = await categoryService.deleteCategory(req.params.id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Category deleted successfully',
    data: result,
  });
});

export const categoryController = {
  createCategory,
  getAllCategories,
  getAllCategoriesWithProviderStats,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
