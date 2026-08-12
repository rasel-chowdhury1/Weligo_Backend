export const USER_ROLE = {
  ADMIN: 'admin',
  PROVIDER: 'provider',
  FAMILY: 'family',
} as const;

export const gender = ['Male', 'Female', 'Others'] as const;
export const Role = Object.values(USER_ROLE);
