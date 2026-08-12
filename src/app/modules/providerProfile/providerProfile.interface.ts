import { Model } from 'mongoose';

export type TCertificate = {
  type: string;
  description: string;
  imgUrl: string;
};

export type TPreferences = {
  nonSmoker: boolean;
  driverLicense: boolean;
  ownVehicle: boolean;
  comfortableWithPets: boolean;
  hasChildren: boolean;
};

export interface TProviderProfile {
  certificates?: TCertificate[];
  shortBioTitle?: string;
  shortBio?: string;
  longBioTitle?: string;
  longBio?: string;
  preferences?: TPreferences;
}

export type ProviderProfileModel = Model<TProviderProfile>;
