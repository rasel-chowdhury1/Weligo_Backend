import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { userService } from './user.service';

import httpStatus from 'http-status';
import { storeFile } from '../../utils/fileHelper';


const registerUser = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.registerUser(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'User registered successfully',
    data: result,
  });
});

const createUser = catchAsync(async (req: Request, res: Response) => {
  console.log(req.body);
  const createUserToken = await userService.createUserToken(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Check email for OTP',
    data: { createUserToken },
  });
});

const userCreateVarification = catchAsync(async (req, res) => {
  console.log('..........1..........');
  const token = req.headers?.token as string;
  console.log('token', token);
  const { otp } = req.body;
  console.log('otp', otp);
  const newUser = await userService.otpVerifyAndCreateUser({ otp, token });

  return sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User create successfully',
    data: newUser,
  });
});

const completedProfile = catchAsync(async (req: Request, res: Response) => {
  if (req?.file) {
    req.body.profileImage = storeFile('profile', req?.file?.filename);
  }

  const result = await userService.completedUser(req?.user?.userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'profile completed successfully',
    data: result,
  });
});

// rest >...............


const getAllUsers = catchAsync(async (req, res) => {
  const {userId} = req.user;
  const result = await userService.getAllUserQuery(userId, req.query);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    meta: result.meta,
    data: result.result,
    message: 'Users All are requered successful!!',
  });
});

const getAllFamilies = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.getAllFamilies(req.query);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    meta: result.meta,
    data: result.result,
    message: 'Families fetched successfully',
  });
});

const getAllProviders = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.getAllProviders(req.query);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    meta: result.meta,
    data: result.result,
    message: 'Providers fetched successfully',
  });
});

const getUserById = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.getUserById(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User fetched successfully',
    data: result,
  });
});


const getProviderDetails = catchAsync(async (req, res) => {
  const { id } = req.params;

  const result = await userService.getProviderDetails(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Provider details retrieved successfully',
    data: result,
  });
});


const getAdminProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.getAdminProfile(req?.user?.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'profile fetched successfully',
    data: result,
  });
});


const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.getMyProfile(req?.user?.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'profile fetched successfully',
    data: result,
  });
});

const getAllUsersOverview = catchAsync(async (req, res) => {
  console.log("get all user overviewo _>>>> ");
  const {userId} = req.user;
  // Default to the current year if the 'year' query parameter is not provided
  const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
  
  // Ensure the year is valid
  if (isNaN(year)) {
    sendResponse(res, {
      statusCode: httpStatus.BAD_REQUEST,
      success: false,
      message: 'Invalid year parameter.',
      data: null,
    });
  }

  const result = await userService.getUsersOverview(userId, year)
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'get all User overview fetched successfully',
    data: result,
  });
});




const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
  if (req?.file) {
    req.body.profileImage = storeFile('profile', req?.file?.filename);
  }
  // console.log('file', req?.file);
  // console.log('body data', req.body);
  
  console.log(req.headers.authorization)

  const result = await userService.updateUser(req?.user?.userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'profile updated successfully',
    data: result,
  });
});

const completeProviderProfile = catchAsync(async (req: Request, res: Response) => {
  const files = req.files as
    | { [fieldname: string]: Express.Multer.File[] }
    | undefined;
  const certificateFiles = files?.certificateFiles;
  const certificates = req.body.certificates as
    | { type: string; description?: string }[]
    | undefined;

  if (certificates?.length) {
    req.body.certificates = certificates.map((certificate, index) => ({
      ...certificate,
      imgUrl: certificateFiles?.[index]
        ? storeFile('certificates', certificateFiles[index].filename)
        : '',
    }));
  }

  if (files?.image?.[0]) {
    req.body.profileImage = storeFile('profile', files.image[0].filename);
  }

  const result = await userService.completeProviderProfile(
    req?.user?.userId,
    req.body,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Provider profile updated successfully',
    data: result,
  });
});

const getPendingProviders = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.getPendingProviders(req.query);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    meta: result.meta,
    data: result.result,
    message: 'Pending providers fetched successfully',
  });
});

const getTopRatedProviders = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.getTopRatedProviders(req.query);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    meta: result.meta,
    data: result.result,
    message: 'Top rated providers fetched successfully',
  });
});

const searchProviders = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.searchProviders(req.query);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    meta: result.meta,
    data: result.result,
    message: 'Providers fetched successfully',
  });
});

const approveProvider = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.approveProvider(req.params.id);

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'Provider approved successfully',
    data: result,
  });
});

const rejectProvider = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.rejectProvider(
    req.params.id,
    req.body?.reason,
  );

  sendResponse(res, {
    success: true,
    statusCode: httpStatus.OK,
    message: 'Provider rejected successfully',
    data: result,
  });
});

const blockedUser = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.blockedUser(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: `User ${result.status ? 'blocked': 'unBlocked'} successfully`,
    data: result.user,
  });
});

const addFavoriteUser = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.addFavoriteUser(
    req.user?.userId,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User added to favorites successfully',
    data: result,
  });
});

const removeFavoriteUser = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.removeFavoriteUser(
    req.user?.userId,
    req.params.id,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User removed from favorites successfully',
    data: result,
  });
});

const getMyFavoriteUsers = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.getMyFavoriteUsers(req.user?.userId);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Favorite users fetched successfully',
    data: result,
  });
});

const deleteMyAccount = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.deleteMyAccount(req.user?.userId, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'User deleted successfully',
    data: result,
  });
});

export const userController = {
  registerUser,
  createUser,
  userCreateVarification,
  completedProfile,
  getUserById,
  getProviderDetails,
  getAdminProfile,
  getMyProfile,
  updateMyProfile,
  completeProviderProfile,
  getPendingProviders,
  getTopRatedProviders,
  searchProviders,
  approveProvider,
  rejectProvider,
  blockedUser,
  deleteMyAccount,
  getAllUsers,
  getAllProviders,
  getAllFamilies,
  getAllUsersOverview,
  addFavoriteUser,
  removeFavoriteUser,
  getMyFavoriteUsers,
};
