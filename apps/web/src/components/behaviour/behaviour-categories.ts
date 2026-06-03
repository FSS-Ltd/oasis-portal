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

export const clubMeritCategories = [
  ...meritCategories,
  'Homework',
  'General Club Merit',
] as const;

export const demeritCategories = [
  'Conduct',
  'Diligence',
  'Respect',
  'Property',
  'Honesty',
  'Serious Misconduct',
  'Misc',
] as const;

export const generalCategories = ['Misc'] as const;

export function categoriesFor(type: BehaviourType): readonly string[] {
  if (type === 'Merit') return meritCategories;
  if (type === 'Demerit') return demeritCategories;
  return generalCategories;
}

export function clubCategoriesFor(type: BehaviourType): readonly string[] {
  if (type === 'Merit') return clubMeritCategories;
  return categoriesFor(type);
}
