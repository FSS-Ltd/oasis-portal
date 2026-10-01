export const ACTIVE_SCORE_KEY_SCOPES = ['all', 'abc-primary', 'secondary'] as const;
export type ActiveScoreKeyScope = (typeof ACTIVE_SCORE_KEY_SCOPES)[number];

export const ACTIVE_SCORE_KEY_SCOPE_LABELS: Record<ActiveScoreKeyScope, string> = {
  all: 'All Levels',
  'abc-primary': 'ABC + Primary',
  secondary: 'Secondary',
};

export interface ActiveScoreKeyRow {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  paceNumber: number;
  childCount: number;
}

export interface ActiveScoreKeyReport {
  scope: ActiveScoreKeyScope;
  generatedAt: Date;
  activeKeyCount: number;
  subjectCount: number;
  rows: ActiveScoreKeyRow[];
}
