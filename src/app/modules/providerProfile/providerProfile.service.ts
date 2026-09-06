import { ProviderProfile } from './providerProfile.model';
import { TCertificate, TPreferences } from './providerProfile.interface';

// A certificate entry sent by the client for an update: `_id` present means
// "edit this existing certificate" (only the provided fields are changed,
// imgUrl is left alone unless a new file was uploaded for it); `_id` absent
// means "add this as a new certificate".
export type TCertificateUpdateInput = {
  _id?: string;
  type?: string;
  description?: string;
  imgUrl?: string;
};

export type TProviderProfileUpdate = {
  shortBioTitle?: string;
  shortBio?: string;
  longBioTitle?: string;
  longBio?: string;
  preferences?: Partial<TPreferences>;
  certificates?: TCertificateUpdateInput[];
  deleteCertificateIds?: string[];
};

const createEmpty = async () => {
  return ProviderProfile.create({});
};

const updateProfile = async (
  profileId: string,
  payload: TProviderProfileUpdate,
) => {
  const { preferences, certificates, deleteCertificateIds, ...bioFields } = payload;

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

  // Scoped to this profile's own certificates array, so a caller can never
  // touch another provider's certificate by passing its _id.
  if (deleteCertificateIds?.length) {
    const idsToDelete = new Set(deleteCertificateIds.map(String));
    profile.certificates = (profile.certificates ?? []).filter(
      (certificate) => !idsToDelete.has(String(certificate._id)),
    );
  }

  if (certificates?.length) {
    certificates.forEach(({ _id, ...fields }) => {
      const existing = _id
        ? profile.certificates?.find((certificate) => String(certificate._id) === String(_id))
        : undefined;

      if (existing) {
        if (fields.type !== undefined) existing.type = fields.type;
        if (fields.description !== undefined) existing.description = fields.description;
        if (fields.imgUrl) existing.imgUrl = fields.imgUrl;
      } else if (!_id) {
        profile.certificates?.push({
          type: fields.type ?? '',
          description: fields.description ?? '',
          imgUrl: fields.imgUrl ?? '',
        });
      }
      // an _id that matches nothing (e.g. belongs to another provider) is
      // silently ignored rather than created as a new certificate
    });
  }

  await profile.save();
  return profile;
};

export const providerProfileService = {
  createEmpty,
  updateProfile,
};
