export type EnvLike = Record<string, string | undefined>;

export function requireEnv(env: EnvLike, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
