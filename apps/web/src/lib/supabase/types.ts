interface SupabaseRelationship {
  columns: string[];
  foreignKeyName: string;
  isOneToOne?: boolean;
  referencedColumns: string[];
  referencedRelation: string;
}

interface SupabaseTable {
  Insert: Record<string, unknown>;
  Relationships: SupabaseRelationship[];
  Row: Record<string, unknown>;
  Update: Record<string, unknown>;
}

interface SupabaseView {
  Relationships: SupabaseRelationship[];
  Row: Record<string, unknown>;
}

interface SupabaseFunction {
  Args: Record<string, unknown>;
  Returns: unknown;
}

export interface SupabaseDatabase {
  public: {
    Functions: Record<string, SupabaseFunction>;
    Tables: Record<string, SupabaseTable>;
    Views: Record<string, SupabaseView>;
  };
}
