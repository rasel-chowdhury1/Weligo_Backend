import { Router } from 'express';
import auth from '../../middleware/auth';
import fileUpload from '../../middleware/fileUpload';
import parseData from '../../middleware/parseData';
import validateRequest from '../../middleware/validateRequest';
import { resentOtpValidations } from '../otp/otp.validation';
import { userController } from './user.controller';
import { userValidation } from './user.validation';
const upload = fileUpload('./public/uploads/profile');

export const userRoutes = Router();

userRoutes
  .post(
    '/register',
    validateRequest(userValidation.registerUserSchema),
    userController.registerUser,
  )

  .post(
    '/create',
    validateRequest(userValidation?.userValidationSchema),
    userController.createUser,
  )

  .post(
    '/create-user-verify-otp',
    validateRequest(resentOtpValidations.verifyOtpZodSchema),
    userController.userCreateVarification,
  )

  .post(
    '/complete',
    auth('user', "admin"),
    upload.single('image'),
    parseData(),
    userController.completedProfile,
  )


  .get(
    '/admin-profile',
    auth(
      'admin'
    ),
    userController.getAdminProfile,
  )
  .get('/all-users', auth("admin"), userController.getAllUsers)
  
  .get("/all-users-overview", auth("admin"), userController.getAllUsersOverview)




  
  .get(
    '/:id',
    auth("user", "admin"),
    userController.getUserById
  )

 

  .patch(
    '/update-my-profile',
    auth('user', "admin"),
    upload.single('image'),
    parseData(),
    userController.updateMyProfile,
  )

  .patch(
    '/block/:id',
    auth('admin'),
    userController.blockedUser,
  )
  
  .delete(
    '/delete-my-account',
    auth('user'
    ),
    userController.deleteMyAccount,
  );

// export default userRoutes;
