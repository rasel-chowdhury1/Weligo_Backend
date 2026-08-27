/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import httpStatus from 'http-status';
import moment from 'moment';
import { Types } from 'mongoose';
import AppError from '../../error/AppError';
import { DeleteAccountPayload, TUser, TUserCreate } from './user.interface';
import { User } from './user.models';
import config from '../../config';
import QueryBuilder from '../../builder/QueryBuilder';
import { otpServices } from '../otp/otp.service';
import { generateOptAndExpireTime } from '../otp/otp.utils';
import { TPurposeType } from '../otp/otp.interface';
import { newUserJoinedEmail, otpSendEmail } from '../../utils/eamilNotifiacation';
import { createToken, verifyToken } from '../../utils/tokenManage';
import Notification from '../notifications/notifications.model';
import { providerProfileService } from '../providerProfile/providerProfile.service';
import { TCertificate, TPreferences } from '../providerProfile/providerProfile.interface';
import Review from '../reveiw/reveiw.model';
import Availability from '../availability/availability.model';
import Booking from '../booking/booking.model';

export type IFilter = {
  searchTerm?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export interface OTPVerifyAndCreateUserProps {
  otp: string;
  token: string;
}

export interface RegisterUserPayload {
  fullName: string;
  email: string;
  password: string;
  address: string;
  role: 'family' | 'provider';
}

const registerUser = async (payload: RegisterUserPayload) => {
  const { fullName, email, password, address, role } = payload;

  const userExist = await User.findOne({ email, role });
  if (userExist) {
    throw new AppError(httpStatus.BAD_REQUEST, `User already registered as ${role} with this email`);
  }

  const user = await User.create({ fullName, email, password, address, role });

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User creation failed');
  }

  process.nextTick(async () => {
    await newUserJoinedEmail({ fullName, email, role });
  });

  const jwtPayload = {
    fullName: user.fullName,
    email: user.email,
    userId: user._id?.toString() as string,
    address: user?.address,
    role: user.role,
  };

  const accessToken = createToken({
    payload: jwtPayload,
    access_secret: config.jwt_access_secret as string,
    expity_time: config.jwt_access_expires_in as string,
  });

  return { user, accessToken };
};

const createUserToken = async (payload: TUserCreate) => {
  console.log('payload service user');
  
  const {
    firstName,
    lastName,
    fullName,
    email,
    password,
    role,
    city,
    postalCode,
    address,
    location,
  } = payload;

  // user exist check
  const userExist = await userService.getUserByEmail(email);

  if (userExist) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User already exist!!');
  }

  const { isExist, isExpireOtp } = await otpServices.checkOtpByEmail(email);

  const { otp, expiredAt } = generateOptAndExpireTime();

  let otpPurpose: TPurposeType = 'email-verification';

  if (isExist && !isExpireOtp) {
    throw new AppError(httpStatus.BAD_REQUEST, 'otp-exist. Check your email.');
  } else if (isExist && isExpireOtp) {
    const otpUpdateData = {
      otp,
      expiredAt,
    };

    await otpServices.updateOtpByEmail(email, otpUpdateData);
  } else if (!isExist) {
    await otpServices.createOtp({
      name: "Customer",
      sentTo: email,
      receiverType: 'email',
      purpose: otpPurpose,
      otp,
      expiredAt,
    });
  }

  const otpBody: Partial<TUserCreate> = {
    email,
    firstName,
    lastName,
    fullName,
    password,
    role,
    city,
    postalCode,
    address,
    location,
  };


  // send email
  console.log('before otp send email');
  process.nextTick(async () => {
    await otpSendEmail({
      sentTo: email,
      subject: 'Your one time otp for email  verification',
      name: "Customer",
      otp,
      expiredAt: expiredAt,
    });
  });
  console.log('after otp send email');

  // crete token
  const createUserToken = createToken({
    payload: otpBody,
    access_secret: config.jwt_access_secret as string,
    expity_time: config.otp_token_expire_time as string | number,
  });


    

  return createUserToken;
  
};

const otpVerifyAndCreateUser = async ({
  otp,
  token,
}: OTPVerifyAndCreateUserProps) => {
  if (!token) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Token not found');
  }

  const decodeData = verifyToken({
    token,
    access_secret: config.jwt_access_secret as string,
  });

  if (!decodeData) {
    throw new AppError(httpStatus.BAD_REQUEST, 'You are not authorised');
  }

  const {
    password,
    email,
    role,
    firstName,
    lastName,
    fullName,
    city,
    postalCode,
    address,
    location,
  } = decodeData;

  console.log({otp})

  const isOtpMatch = await otpServices.otpMatch(email, otp);

  if (!isOtpMatch) {
    throw new AppError(httpStatus.BAD_REQUEST, 'OTP did not match');
  }

  process.nextTick(async () => {
    await otpServices.updateOtpByEmail(email, {
      status: 'verified',
    });
  });


  const isExist = await User.isUserExist(email as string);

  if (isExist) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'User already exists with this email',
    );
  }



  const userData = {
    password,
    email,
    role,
    firstName,
    lastName,
    fullName,
    city,
    postalCode,
    address,
    location,
  };
  

  const user = await User.create(userData);

  console.log({user})

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User creation failed');
  }


    const jwtPayload: {
      userId: string;
      role: string;
      email: string;
    } = {
      email: user.email,
      userId: user?._id?.toString() as string,
      role: user?.role,
    };

    // console.log({ jwtPayload });

    const accessToken = createToken({
      payload: jwtPayload,
      access_secret: config.jwt_access_secret as string,
      expity_time: '5m',
    });


  return accessToken;
};

const completedUser = async (id: string, payload: Partial<TUser>) => {
  const { role, email, status, isDeleted,password, ...rest } = payload;

  console.log('rest data',rest)

  const user = await User.findByIdAndUpdate(id, rest, { new: true });

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User completing failed');
  }

  const newNotification = new Notification({
    userId: user?._id, // Ensure that userId is of type mongoose.Types.ObjectId
    receiverId: "67f4c294dca4296adb805029", // Ensure that receiverId is of type mongoose.Types.ObjectId
    message: {
      fullName: user.fullName || "",
      image: user.profileImage || "", // Placeholder image URL (adjust this)
      text: "New user added in your app"
    },
    type: "added", // Use the provided type (default to "FollowRequest")
    isRead: false, // Set to false since the notification is unread initially
    timestamp: new Date(), // Timestamp of when the notification is created
  });

  console.log({newNotification})

   const result = await newNotification.save();

   console.log("===new notifications --->>> ", result)

  return user;
};

const updateUser = async (id: string, payload: Partial<TUser>) => {
  const { role, email, status, isDeleted,password, ...rest } = payload;

  console.log('rest data',rest)

  const user = await User.findByIdAndUpdate(id, rest, { new: true });

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, 'User updating failed');
  }

  return user;
};

export interface CompleteProviderProfilePayload {
  profileImage?: string;
  phone?: string;
  referralSource?: string;
  categoryId?: string;
  hourlyRate?: number;
  experience?: number;
  lenguages?: string[];
  shortBioTitle?: string;
  shortBio?: string;
  longBioTitle?: string;
  longBio?: string;
  preferences?: Partial<TPreferences>;
  certificates?: TCertificate[];
}

const completeProviderProfile = async (
  userId: string,
  payload: CompleteProviderProfilePayload,
) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user.role !== 'provider') {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Only provider accounts can update a provider profile',
    );
  }

  const {
    profileImage,
    phone,
    referralSource,
    categoryId,
    hourlyRate,
    experience,
    lenguages,
    shortBioTitle,
    shortBio,
    longBioTitle,
    longBio,
    preferences,
    certificates,
  } = payload;

  let providerProfileId = user.providerProfileId;

  if (!providerProfileId) {
    const newProfile = await providerProfileService.createEmpty();
    providerProfileId = newProfile._id.toString();
  }

  await providerProfileService.updateProfile(providerProfileId, {
    shortBioTitle,
    shortBio,
    longBioTitle,
    longBio,
    preferences,
    newCertificates: certificates,
  });

  const userUpdate: Partial<TUser> = { providerProfileId };
  if (profileImage !== undefined) userUpdate.profileImage = profileImage;
  if (phone !== undefined) userUpdate.phone = phone;
  if (referralSource !== undefined) userUpdate.referralSource = referralSource;
  if (categoryId !== undefined) userUpdate.categoryId = categoryId;
  if (hourlyRate !== undefined) userUpdate.hourlyRate = hourlyRate;
  if (experience !== undefined) userUpdate.experience = experience;
  if (lenguages !== undefined) userUpdate.lenguages = lenguages;

  const updatedUser = await User.findByIdAndUpdate(userId, userUpdate, {
    new: true,
  }).populate('providerProfileId');

  return updatedUser;
};

// ............................rest

const getAllUserQuery = async (userId: string, query: Record<string, unknown>) => {
  const userQuery = new QueryBuilder(User.find({ _id: { $ne: userId } }), query)
    .search(['fullName'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await userQuery.modelQuery;
  const meta = await userQuery.countTotal();
  return { meta, result };
};

const getAllFamilies = async (query: Record<string, unknown>) => {
  const userQuery = new QueryBuilder(User.find({ role: 'family' }), query)
    .search(['fullName', 'email'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await userQuery.modelQuery;
  const meta = await userQuery.countTotal();
  return { meta, result };
};

const getAllProviders = async (query: Record<string, unknown>) => {
  const userQuery = new QueryBuilder(User.find({ role: 'provider' }), query)
    .search(['fullName', 'email'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await userQuery.modelQuery;
  const meta = await userQuery.countTotal();
  return { meta, result };
};


const getAllUserCount = async () => {
  const allUserCount = await User.countDocuments();
  return allUserCount;
};

const getUsersOverview = async (userId:string, year:any) => {
  try {
    // Fetch total user count
    const totalUsers = await User.countDocuments();

    // Fetch user growth over time for the specified year (monthly count with month name)
    const userOverview = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(`${year}-01-01`), $lt: new Date(`${year + 1}-01-01`) }, // Filter by year
        },
      },
      {
        $group: {
          _id: { $month: '$createdAt' }, // Group by month of the 'createdAt' date
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 1,
          count: 1,
          monthName: {
            $switch: {
              branches: [
                { case: { $eq: ["$_id", 1] }, then: "January" },
                { case: { $eq: ["$_id", 2] }, then: "February" },
                { case: { $eq: ["$_id", 3] }, then: "March" },
                { case: { $eq: ["$_id", 4] }, then: "April" },
                { case: { $eq: ["$_id", 5] }, then: "May" },
                { case: { $eq: ["$_id", 6] }, then: "June" },
                { case: { $eq: ["$_id", 7] }, then: "July" },
                { case: { $eq: ["$_id", 8] }, then: "August" },
                { case: { $eq: ["$_id", 9] }, then: "September" },
                { case: { $eq: ["$_id", 10] }, then: "October" },
                { case: { $eq: ["$_id", 11] }, then: "November" },
                { case: { $eq: ["$_id", 12] }, then: "December" },
              ],
              default: "Unknown", // Default value in case month is not valid
            },
          },
        },
      },
      { $sort: { _id: 1 } }, // Sort by month (ascending)
    ]);

    // Fetch recent users
    const recentUsers = await User.find({ _id: { $ne: userId } }).sort({ createdAt: -1 }).limit(6);

    return {
      totalUsers,
      userOverview, // Includes month names with user counts
      recentUsers,
    };
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    throw new Error('Error fetching dashboard data.');
  }
};



const getUserById = async (id: string) => {
  const result = await User.findById(id);
  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  return result;
};



const getProviderDetails = async (id: string) => {
  const provider = await User.findOne({
    _id: id,
    role: 'provider',
    approvalStatus: 'approved',
    status: 'active',
  })
    .populate({
      path: 'providerProfileId',
    })
    .populate({
      path: 'categoryId',
      select: 'name image',
    })
    .lean();

  if (!provider) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      'Provider not found',
    );
  }

  const [reviews, ratingSummary, availability, bookings] =
    await Promise.all([
      // Reviews
      Review.find({
        receiverId: provider._id,
        isDeleted: false,
      })
        .populate({
          path: 'reviewerId',
          select: 'firstName lastName fullName profileImage',
        })
        .sort({ createdAt: -1 })
        .lean(),

      // Rating distribution
      Review.aggregate([
        {
          $match: {
            receiverId: provider._id,
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: '$rating',
            count: { $sum: 1 },
          },
        },
      ]),

      // Provider availability
      Availability.findOne({
        user: provider._id,
      }).lean(),

      // Confirmed bookings
      Booking.find({
        serviceProvider: provider._id,
        status: { $in: ['pending', 'confirmed'] },
        bookingDate: {
          $gte: new Date(),
        },
      })
        .select(`
          _id
          bookingReference
          customer
          bookingDate
          dayOfWeek
          timeSlotId
          timeSlot
          durationInHours
          ageGroup
          numberOfPersons
          status
        `)
        .populate({
          path: 'customer',
          select: 'firstName lastName fullName profileImage',
        })
        .sort({ bookingDate: 1 })
        .lean(),
    ]);

  // Total reviews
  const totalReviews = ratingSummary.reduce(
    (sum, item) => sum + item.count,
    0,
  );

  // Rating distribution
  const ratingDistribution = [5, 4, 3, 2, 1].map((rating) => {
    const ratingData = ratingSummary.find(
      (item) => item._id === rating,
    );

    const count = ratingData?.count || 0;

    return {
      rating,
      count,
      percentage:
        totalReviews > 0
          ? Math.round((count / totalReviews) * 100)
          : 0,
    };
  });

  return {
    user: {
      _id: provider._id,
      firstName: provider.firstName,
      lastName: provider.lastName,
      fullName: provider.fullName,
      email: provider.email,
      profileImage: provider.profileImage,
      phone: provider.phone,
      city: provider.city,
      postalCode: provider.postalCode,
      address: provider.address,
      categoryId: provider.categoryId,
      category: provider.category,
      hourlyRate: provider.hourlyRate,
      experience: provider.experience,
      lenguages: provider.lenguages,
      averageRating: provider.averageRating,
      totalReview: provider.totalReview,
      location: provider.location,
    },

    profile: provider.providerProfileId,

    reviews,

    ratingSummary: {
      totalReviews,
      averageRating: provider.averageRating,
      ratings: ratingDistribution,
    },

    availability,

    bookings,
  };
};


const getAdminProfile = async (id: string) => {
  const result = await User.findById(id).lean()

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }


  return result;
};

const getMyProfile = async (id: string) => {
  const result = await User.findById(id);

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  return result;
};

const getUserByEmail = async (email: string) => {
  const result = await User.findOne({ email });

  return result;
};

const addFavoriteUser = async (userId: string, favoriteUserId: string) => {
  if (userId === favoriteUserId) {
    throw new AppError(httpStatus.BAD_REQUEST, 'You cannot favorite yourself');
  }

  const favoriteUser = await User.findById(favoriteUserId);
  if (!favoriteUser) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  const result = await User.findByIdAndUpdate(
    userId,
    { $addToSet: { favoriteUsers: favoriteUserId } },
    { new: true },
  ).populate('favoriteUsers', 'fullName profileImage role averageRating');

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  return result;
};

const removeFavoriteUser = async (userId: string, favoriteUserId: string) => {
  const result = await User.findByIdAndUpdate(
    userId,
    { $pull: { favoriteUsers: favoriteUserId } },
    { new: true },
  ).populate('favoriteUsers', 'fullName profileImage role averageRating');

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  return result;
};

const getMyFavoriteUsers = async (userId: string) => {
  const result = await User.findById(userId).populate({
    path: 'favoriteUsers',
    select: 'fullName profileImage role averageRating totalReview address hourlyRate categoryId',
    populate: { path: 'categoryId', select: 'name' },
  });

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  return result.favoriteUsers;
};

const deleteMyAccount = async (id: string, payload: DeleteAccountPayload) => {
  const user: TUser | null = await User.IsUserExistById(id);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (user?.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, 'This user is deleted');
  }

  if (!(await User.isPasswordMatched(payload.password, user.password))) {
    throw new AppError(httpStatus.BAD_REQUEST, 'Password does not match');
  }

  const userDeleted = await User.findByIdAndUpdate(
    id,
    { isDeleted: true },
    { new: true },
  );

  if (!userDeleted) {
    throw new AppError(httpStatus.BAD_REQUEST, 'user deleting failed');
  }

  return userDeleted;
};

const getPendingProviders = async (query: Record<string, unknown>) => {
  const userQuery = new QueryBuilder(
    User.find({ role: 'provider', approvalStatus: 'pending' }),
    query,
  )
    .search(['fullName'])
    .filter()
    .sort()
    .paginate()
    .fields();

  const result = await userQuery.modelQuery
    .populate('categoryId', 'name')
    .populate('providerProfileId');
  const meta = await userQuery.countTotal();
  return { meta, result };
};

const getTopRatedProviders = async (query: Record<string, unknown>) => {
  const userQuery = new QueryBuilder(
    User.find({
      role: 'provider',
      approvalStatus: 'approved',
      status: 'active',
    }),
    {
      sort: '-averageRating,-totalReview',
      ...query,
    },
  )
    .search(['fullName'])
    .filter()
    .paginate()
    .sort()
    .fields();

  const result = await userQuery.modelQuery
    .populate('categoryId', 'name')
    .populate('providerProfileId');
  const meta = await userQuery.countTotal();
  return { meta, result };
};

export interface SearchProvidersQuery {
  categoryId?: string;
  address?: string;
  searchTerm?: string; // matches provider fullName or email
  date?: string; // "YYYY-MM-DD"
  time?: string; // "HH:mm"
  sortBy?: 'nearest' | 'top_rated' | 'price_low' | 'price_high';
  lat?: string | number;
  lng?: string | number;
  page?: string | number;
  limit?: string | number;
}

const searchProviders = async (query: SearchProvidersQuery) => {
  const {
    categoryId,
    address,
    searchTerm,
    date,
    time,
    sortBy,
    lat,
    lng,
    page = 1,
    limit = 10,
  } = query;

  const matchStage: Record<string, any> = {
    role: 'provider',
    approvalStatus: 'approved',
    status: 'active',
    isDeleted: { $ne: true },
  };

  if (categoryId) {
    matchStage.categoryId = new Types.ObjectId(categoryId);
  }

  // address and searchTerm each need their own $or, so combine them under
  // $and instead of overwriting matchStage.$or when both are supplied
  const andConditions: Record<string, any>[] = [];

  if (address) {
    andConditions.push({
      $or: [
        { address: { $regex: address, $options: 'i' } },
        { city: { $regex: address, $options: 'i' } },
        { postalCode: { $regex: address, $options: 'i' } },
      ],
    });
  }

  if (searchTerm) {
    andConditions.push({
      $or: [
        { fullName: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } },
      ],
    });
  }

  if (andConditions.length) {
    matchStage.$and = andConditions;
  }

  const pipeline: Record<string, any>[] = [];

  if (sortBy === 'nearest') {
    if (lat === undefined || lng === undefined) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'lat and lng are required to sort by nearest',
      );
    }

    // $geoNear must be the first stage of the pipeline
    pipeline.push({
      $geoNear: {
        near: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
        distanceField: 'distance',
        query: matchStage,
        spherical: true,
      },
    });
  } else {
    pipeline.push({ $match: matchStage });
  }

  if (date) {
    const day = moment(date).format('dddd').toLowerCase();

    const dayMatch: Record<string, any> = { day, isAvailable: true };
    if (time) {
      dayMatch.slots = {
        $elemMatch: { startTime: { $lte: time }, endTime: { $gt: time } },
      };
    }

    pipeline.push(
      {
        $lookup: {
          from: 'availabilities',
          localField: '_id',
          foreignField: 'user',
          as: 'availability',
        },
      },
      { $unwind: '$availability' },
      {
        $match: {
          'availability.bookingRules.acceptingBookings': true,
          'availability.weeklySchedule': { $elemMatch: dayMatch },
        },
      },
    );
  }

  switch (sortBy) {
    case 'top_rated':
      pipeline.push({ $sort: { averageRating: -1, totalReview: -1 } });
      break;
    case 'price_low':
      pipeline.push({ $sort: { hourlyRate: 1 } });
      break;
    case 'price_high':
      pipeline.push({ $sort: { hourlyRate: -1 } });
      break;
    case 'nearest':
      // $geoNear already sorted results by ascending distance
      break;
    default:
      pipeline.push({ $sort: { averageRating: -1 } });
  }

  const skip = (Number(page) - 1) * Number(limit);

  pipeline.push({
    $facet: {
      data: [
        { $skip: skip },
        { $limit: Number(limit) },
        {
          $lookup: {
            from: 'categories',
            localField: 'categoryId',
            foreignField: '_id',
            as: 'categoryId',
            pipeline: [{ $project: { name: 1 } }],
          },
        },
        { $unwind: { path: '$categoryId', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            firstName: 1,
            lastName: 1,
            fullName: 1,
            email: 1,
            profileImage: 1,
            role: 1,
            category: 1,
            categoryId: 1,
            phone: 1,
            city: 1,
            postalCode: 1,
            address: 1,
            hourlyRate: 1,
            experience: 1,
            lenguages: 1,
            totalReview: 1,
            averageRating: 1,
            location: 1,
          },
        },
      ],
      totalCount: [{ $count: 'total' }],
    },
  });

  // use the raw collection to bypass the isDeleted pre('aggregate') hook,
  // since it would unshift a $match stage before $geoNear (which must be first)
  const [aggregationResult] = await User.collection
    .aggregate(pipeline)
    .toArray();

  const result = aggregationResult?.data || [];
  const total = aggregationResult?.totalCount?.[0]?.total || 0;
  const totalPage = Math.ceil(total / Number(limit));

  return {
    meta: { page: Number(page), limit: Number(limit), total, totalPage },
    result,
  };
};

const approveProvider = async (id: string) => {
  const provider = await User.findById(id);

  if (!provider) {
    throw new AppError(httpStatus.NOT_FOUND, 'Provider not found');
  }

  if (provider.role !== 'provider') {
    throw new AppError(httpStatus.BAD_REQUEST, 'This user is not a provider');
  }

  const user = await User.findByIdAndUpdate(
    id,
    { approvalStatus: 'approved', rejectionReason: '' },
    { new: true },
  );

  return user;
};

const rejectProvider = async (id: string, rejectionReason?: string) => {
  const provider = await User.findById(id);

  if (!provider) {
    throw new AppError(httpStatus.NOT_FOUND, 'Provider not found');
  }

  if (provider.role !== 'provider') {
    throw new AppError(httpStatus.BAD_REQUEST, 'This user is not a provider');
  }

  const user = await User.findByIdAndUpdate(
    id,
    { approvalStatus: 'rejected', rejectionReason: rejectionReason || '' },
    { new: true },
  );

  return user;
};

const blockedUser = async (id: string) => {
  const singleUser = await User.IsUserExistById(id);

  if (!singleUser) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }
  
  // let status;

  // if (singleUser?.isActive) {
  //   status = false;
  // } else {
  //   status = true;
  // }
const status = singleUser.status === 'blocked' ? 'active' : 'blocked';
  console.log('status', status);
  const user = await User.findByIdAndUpdate(
    id,
    { status },
    { new: true },
  );

  if (!user) {
    throw new AppError(httpStatus.BAD_REQUEST, 'user deleting failed');
  }

  return {status, user};
};



export const userService = {
  registerUser,
  createUserToken,
  otpVerifyAndCreateUser,
  completedUser,
  getAdminProfile,
  getMyProfile,
  getUserById,
  getProviderDetails,
  getUserByEmail,
  updateUser,
  completeProviderProfile,
  deleteMyAccount,
  blockedUser,
  getPendingProviders,
  getTopRatedProviders,
  searchProviders,
  approveProvider,
  rejectProvider,
  getAllUserQuery,
  getAllProviders,
  getAllFamilies,
  getAllUserCount,
  getUsersOverview,
  addFavoriteUser,
  removeFavoriteUser,
  getMyFavoriteUsers,
};
