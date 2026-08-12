import { ProviderProfile } from './providerProfile.model';
import { TCertificate, TPreferences } from './providerProfile.interface';

export type TProviderProfileUpdate = {
  shortBioTitle?: string;
  shortBio?: string;
  longBioTitle?: string;
  longBio?: string;
  preferences?: Partial<TPreferences>;
  newCertificates?: TCertificate[];
};

const createEmpty = async () => {
  return ProviderProfile.create({});
};

const updateProfile = async (
  profileId: string,
  payload: TProviderProfileUpdate,
) => {
  const { preferences, newCertificates, ...bioFields } = payload;

  const profile = await ProviderProfile.findById(profileId);

  if (!profile) {
    return null;
  }

  Object.assign(profile, bioFields);

  if (preferences) {
    profile.preferences = {
      ...profile.preferences,
      ...preferences,
    } as TPreferences;
  }

  if (newCertificates?.length) {
    profile.certificates?.push(...newCertificates);
  }

  await profile.save();
  return profile;
};

export const providerProfileService = {
  createEmpty,
  updateProfile,
};
