export type BehaviourType = 'Merit' | 'Demerit' | 'General';

export const meritCategories = [
  'Scripture Memory',
  'Academic Excellence',
  'Helpfulness',
  'Character',
  'Leadership',
  'Punctuality',
  'Creativity',
] as const;

export const demeritCategories = [
  'Misc',
  'Punctuality',
  'Conduct',
  'Disrespect',
  'Negligence',
  'Dishonesty',
] as const;

export const generalCategories = ['Misc'] as const;

export function categoriesFor(type: BehaviourType): readonly string[] {
  if (type === 'Merit') return meritCategories;
  if (type === 'Demerit') return demeritCategories;
  return generalCategories;
}
