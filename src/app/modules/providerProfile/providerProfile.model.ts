import { model, Schema } from 'mongoose';
import { ProviderProfileModel, TProviderProfile } from './providerProfile.interface';

const certificateSchema = new Schema(
  {
    type: {
      type: String,
    },
    description: {
      type: String,
    },
    imgUrl: {
      type: String,
    },
  },
  { timestamps: true },
);

const providerProfileSchema = new Schema<TProviderProfile>(
  {
    certificates: {
      type: [certificateSchema],
      default: [],
    },
    shortBioTitle: {
      type: String,
      default: '',
    },
    shortBio: {
      type: String,
      default: '',
    },
    longBioTitle: {
      type: String,
      default: '',
    },
    longBio: {
      type: String,
      default: '',
    },
    preferences: {
      nonSmoker: {
        type: Boolean,
        default: false,
      },
      driverLicense: {
        type: Boolean,
        default: false,
      },
      ownVehicle: {
        type: Boolean,
        default: false,
      },
      comfortableWithPets: {
        type: Boolean,
        default: false,
      },
      hasChildren: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  },
);

export const ProviderProfile = model<TProviderProfile, ProviderProfileModel>(
  'ProviderProfile',
  providerProfileSchema,
);
