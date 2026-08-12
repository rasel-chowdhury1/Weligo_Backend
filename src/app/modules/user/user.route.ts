import { Router } from 'express';
import auth from '../../middleware/auth';
import fileUpload from '../../middleware/fileUpload';
import parseData from '../../middleware/parseData';
import validateRequest from '../../middleware/validateRequest';
import { resentOtpValidations } from '../otp/otp.validation';
import { userController } from './user.controller';
import { userValidation } from './user.validation';
import { USER_ROLE } from './user.constants';
const upload = fileUpload('./public/uploads/profile');
const certificateUpload = fileUpload('./public/uploads/certificates');
const providerProfileUpload = certificateUpload.fields([
  { name: 'certificateFiles', maxCount: 10 },
  { name: 'image', maxCount: 1 },
]);

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
    auth(USER_ROLE.PROVIDER, USER_ROLE.FAMILY, USER_ROLE.ADMIN),
    upload.single('image'),
    parseData(),
    userController.completedProfile,
  )

  .patch(
    '/provider-profile',
    auth(USER_ROLE.PROVIDER),
    providerProfileUpload,
    parseData(),
    validateRequest(userValidation.completeProviderProfileZodSchema),
    userController.completeProviderProfile,
  )


  .get(
    '/admin-profile',
    auth(
      USER_ROLE.ADMIN
    ),
    userController.getAdminProfile,
  )

  .get(
    '/all-users', 
    auth(USER_ROLE.ADMIN), 
    userController.getAllUsers
  )

  .get("/all-users-overview", auth(USER_ROLE.ADMIN), userController.getAllUsersOverview)

  .get(
    '/all-families',
    // auth(USER_ROLE.ADMIN),
    userController.getAllFamilies,
  )

  .get(
    '/pending-providers',
    // auth(USER_ROLE.ADMIN),
    userController.getPendingProviders,
  )

  .patch(
    '/approve-provider/:id',
    // auth(USER_ROLE.ADMIN),
    userController.approveProvider,
  )

  .patch(
    '/reject-provider/:id',
    // auth(USER_ROLE.ADMIN),
    userController.rejectProvider,
  )




  
  .get(
    '/my-profile',
    auth(USER_ROLE.PROVIDER, USER_ROLE.FAMILY, USER_ROLE.ADMIN),
    userController.getMyProfile,
  )

  .get(
    '/top-rated-providers',
    userController.getTopRatedProviders,
  )

  .get(
    '/search-providers',
    userController.searchProviders,
  )

  .get(
    '/favorites',
    auth(USER_ROLE.PROVIDER, USER_ROLE.FAMILY, USER_ROLE.ADMIN),
    userController.getMyFavoriteUsers,
  )

  .post(
    '/favorites/:id',
    auth(USER_ROLE.PROVIDER, USER_ROLE.FAMILY, USER_ROLE.ADMIN),
    userController.addFavoriteUser,
  )

  .delete(
    '/favorites/:id',
    auth(USER_ROLE.PROVIDER, USER_ROLE.FAMILY, USER_ROLE.ADMIN),
    userController.removeFavoriteUser,
  )

  .get(
    '/provider/:id',
    // auth(USER_ROLE.PROVIDER, USER_ROLE.FAMILY, USER_ROLE.ADMIN),
    userController.getProviderDetails
  )

  .get(
    '/:id',
    auth(USER_ROLE.PROVIDER, USER_ROLE.FAMILY, USER_ROLE.ADMIN),
    userController.getUserById
  )

 

  .patch(
    '/update-my-profile',
    auth(USER_ROLE.PROVIDER, USER_ROLE.FAMILY, USER_ROLE.ADMIN),
    upload.single('image'),
    parseData(),
    userController.updateMyProfile,
  )

  .patch(
    '/block/:id',
    auth(USER_ROLE.ADMIN),
    userController.blockedUser,
  )
  
  .delete(
    '/delete-my-account',
    auth(USER_ROLE.PROVIDER, USER_ROLE.FAMILY, USER_ROLE.ADMIN),
    userController.deleteMyAccount,
  );

// export default userRoutes;
