export interface ActiveScoreKeyRow {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  paceNumber: number;
  childCount: number;
}

export interface ActiveScoreKeyReport {
  generatedAt: Date;
  activeKeyCount: number;
  subjectCount: number;
  rows: ActiveScoreKeyRow[];
}
