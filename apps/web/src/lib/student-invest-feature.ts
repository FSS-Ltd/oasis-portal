type StudentInvestEnv = {
  NEXT_PUBLIC_VERCEL_ENV?: string | undefined;
  VERCEL_ENV?: string | undefined;
};

export function canUseStudentInvestPrototype(
  env: StudentInvestEnv = {
    NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
  },
): boolean {
  return env.VERCEL_ENV !== 'production' && env.NEXT_PUBLIC_VERCEL_ENV !== 'production';
}
