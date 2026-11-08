/** AWS profile / CLI id safe for single-quoted shell interpolation. */
const SAFE_AWS_PROFILE = /^[A-Za-z0-9._+=,@-]+$/;

export function isSafeAwsProfileId(profile: string | undefined): profile is string {
  return typeof profile === 'string' && profile.length > 0 && SAFE_AWS_PROFILE.test(profile);
}
