import bcrypt from 'bcrypt';
import { Error, model, Schema } from 'mongoose';
import config from '../../config';
import { TUser, UserModel } from './user.interface';

const userSchema = new Schema<TUser>(
  {
    firstName: {
      type: String,
      default: '',
    },
    lastName: {
      type: String,
      default: '',
    },
    fullName: {
      type: String,
      default: '',
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    profileImage: {
      type: String,
      default: '',
    },
    role: {
      enum: ['family', 'provider', 'user', 'admin'],
      type: String,
      default: 'user',
    },
    phone: {
      type: String,
      default: '',
    },
    city: {
      type: String,
      default: '',
    },
    postalCode: {
      type: String,
      default: '',
    },
    address: {
      type: String,
      default: ''
    },
    referralSource: {
      type: String,
      default: '',
    },
    dateOfBirth: {
      type: Date,
      default: ""
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      default: null
    },
    category: {
      type: String,
      default: '',
    },
    hourlyRate: {
      type: Number,
      default: 0,
    },
    experience: {
      type: Number,
      default: 0,
    },
    lenguages: {
      type: [String],
      default: [],
    },
    totalReview: {
      type: Number,
      default: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
    },
    providerProfileId: {
      type: Schema.Types.ObjectId,
      ref: 'ProviderProfile',
      default: null,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: undefined,
      },
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: function (this: { role: string }) {
        return this.role === 'provider' ? 'pending' : 'approved';
      },
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    favoriteUsers: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    status: {
      type: String,
      enum: ['active', 'blocked', 'banned'],
      default: 'active',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
  },
);

userSchema.pre('save', async function (next) {
  // eslint-disable-next-line @typescript-eslint/no-this-alias
  const user = this;
  user.password = await bcrypt.hash(
    user.password,
    Number(config.bcrypt_salt_rounds),
  );
  next();
});

// set '' after saving password
userSchema.post(
  'save',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function (error: Error, doc: any, next: (error?: Error) => void): void {
    doc.password = '';
    next();
  },
);

userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password; // Remove password field
  return user;
};

// filter out deleted documents
userSchema.pre('find', function (next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

userSchema.pre('findOne', function (next) {
  this.find({ isDeleted: { $ne: true } });
  next();
});

userSchema.pre('aggregate', function (next) {
  this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
  next();
});

userSchema.statics.isUserExist = async function (email: string) {
  console.log({ email });
  return await User.findOne({ email: email }).select('+password');
};

userSchema.statics.isUserActive = async function (email: string) {
  return await User.findOne({
    email: email,
    isDeleted: false
  }).select('+password');
};

userSchema.statics.IsUserExistById = async function (id: string) {
  return await User.findById(id).select('+password');
};

userSchema.statics.isPasswordMatched = async function (
  plainTextPassword,
  hashedPassword,
) {
  return await bcrypt.compare(plainTextPassword, hashedPassword);
};

userSchema.index({ email: 1, role: 1 }, { unique: true });
userSchema.index({ location: '2dsphere' });

export const User = model<TUser, UserModel>('User', userSchema);
