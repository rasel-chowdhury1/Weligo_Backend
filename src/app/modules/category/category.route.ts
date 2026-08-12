import { Router } from 'express';
import auth from '../../middleware/auth';
import fileUpload from '../../middleware/fileUpload';
import parseData from '../../middleware/parseData';
import validateRequest from '../../middleware/validateRequest';
import { USER_ROLE } from '../user/user.constants';
import { categoryController } from './category.controller';
import { categoryValidation } from './category.validation';

const upload = fileUpload('./public/uploads/category');

const categoryFiles = upload.fields([
  { name: 'icon', maxCount: 1 },
  { name: 'image', maxCount: 1 },
]);

export const categoryRoutes = Router();

categoryRoutes
  .post(
    '/create',
    // auth(USER_ROLE.ADMIN),
    categoryFiles,
    parseData(),
    validateRequest(categoryValidation.createCategoryZodSchema),
    categoryController.createCategory,
  )

  .get('/', categoryController.getAllCategories)

  .get(
  '/with-stats',
    categoryController.getAllCategoriesWithProviderStats,
  )

  .get('/:id', categoryController.getCategoryById)

  .patch(
    '/:id',
    // auth(USER_ROLE.ADMIN),
    categoryFiles,
    parseData(),
    validateRequest(categoryValidation.updateCategoryZodSchema),
    categoryController.updateCategory,
  )

  .delete(
    '/:id', 
    // auth(USER_ROLE.ADMIN), 
    categoryController.deleteCategory);
