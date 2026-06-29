import type { Role } from '@prisma/client';

export const CLIENT_DEMO_SEED_CONFIRMATION = 'reset-isolated-client-demo-database';
const CLIENT_DEMO_DATABASE_ISOLATION = 'dedicated-demo-database';

type EnvLike = Record<string, string | undefined>;

type ClientDemoSeedEnvironment = {
  appUrl: string;
  schema: string;
};

type DatabaseSchemaMetadata = {
  currentSchema: string;
};

export type ClientDemoUserSpec = {
  id: string;
  role: Role;
  email: string;
  fullName: string;
  password: string;
  tags: string[];
  linkedAsGuardian?: boolean;
};

export type ClientDemoStudentSpec = {
  id: string;
  userId?: string;
  fullName: string;
  dob: string;
  address: string;
  yearGroup: string;
  enrolmentDate: string;
};

export type ClientDemoPlan = {
  emailDomain: string;
  users: ClientDemoUserSpec[];
  students: ClientDemoStudentSpec[];
  coverage: string[];
};

type BuildClientDemoPlanInput = {
  emailDomain: string;
  password: string;
};

export function validateClientDemoSeedEnvironment(
  env: EnvLike,
  dbMeta: DatabaseSchemaMetadata,
): ClientDemoSeedEnvironment {
  const confirmation = env['OASIS_CLIENT_DEMO_SEED_CONFIRMATION']?.trim();
  if (confirmation !== CLIENT_DEMO_SEED_CONFIRMATION) {
    throw new Error(
      `Set OASIS_CLIENT_DEMO_SEED_CONFIRMATION=${CLIENT_DEMO_SEED_CONFIRMATION} to reset and seed the isolated demo database.`,
    );
  }

  return validateClientDemoRuntimeEnvironment(env, dbMeta);
}

export function validateClientDemoRuntimeEnvironment(
  env: EnvLike,
  dbMeta: DatabaseSchemaMetadata,
): ClientDemoSeedEnvironment {
  const schema = env['OASIS_CLIENT_DEMO_SCHEMA']?.trim();
  if (!schema) throw new Error('OASIS_CLIENT_DEMO_SCHEMA is required.');
  if (!/^[a-z][a-z0-9_]*$/u.test(schema)) {
    throw new Error('OASIS_CLIENT_DEMO_SCHEMA must be a lowercase PostgreSQL identifier.');
  }
  validateNotProductionSupabaseProject(env);
  if (schema.toLowerCase() === 'public') {
    validateDedicatedDemoDatabase(env);
  }

  const currentSchema = dbMeta.currentSchema.trim();
  if (currentSchema !== schema) {
    throw new Error(
      `Database connection is using schema "${currentSchema}", expected "${schema}". Check DATABASE_URL/DIRECT_URL search_path.`,
    );
  }

  const rawAppUrl = env['APP_URL']?.trim();
  if (!rawAppUrl) throw new Error('APP_URL is required for client demo seeding.');

  let appUrl: URL;
  try {
    appUrl = new URL(rawAppUrl);
  } catch {
    throw new Error('APP_URL must be an absolute URL.');
  }

  const host = appUrl.hostname.toLowerCase();
  const isLocalDemo = host === 'localhost' || host === '127.0.0.1';
  if (!isLocalDemo && !host.includes('demo')) {
    throw new Error('APP_URL must point to a demo host, not the live production host.');
  }

  return { appUrl: appUrl.toString().replace(/\/$/u, ''), schema };
}

function validateDedicatedDemoDatabase(env: EnvLike): void {
  if (env['OASIS_CLIENT_DEMO_DATABASE_ISOLATION']?.trim() !== CLIENT_DEMO_DATABASE_ISOLATION) {
    throw new Error(
      `Client demo seed may target public only in a dedicated demo database. Set OASIS_CLIENT_DEMO_DATABASE_ISOLATION=${CLIENT_DEMO_DATABASE_ISOLATION}.`,
    );
  }

  if (!extractCurrentSupabaseProjectRef(env)) {
    throw new Error(
      'DATABASE_URL or DIRECT_URL must identify the dedicated demo Supabase project when seeding public.',
    );
  }
}

function validateNotProductionSupabaseProject(env: EnvLike): void {
  const currentRef = extractCurrentSupabaseProjectRef(env);
  if (!currentRef) return;

  const productionRef = env['OASIS_PRODUCTION_SUPABASE_REF']?.trim();
  if (!productionRef) {
    throw new Error(
      'OASIS_PRODUCTION_SUPABASE_REF is required when seeding or verifying a Supabase demo environment.',
    );
  }
  if (currentRef === productionRef) {
    throw new Error('Client demo seed must not target the production Supabase project.');
  }
}

function extractCurrentSupabaseProjectRef(env: EnvLike): string | null {
  return extractSupabaseProjectRef(env['DIRECT_URL']?.trim() || env['DATABASE_URL']?.trim() || '');
}

function extractSupabaseProjectRef(rawUrl: string): string | null {
  if (!rawUrl) return null;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const directHostMatch = /^db\.([a-z0-9]+)\.supabase\.co$/u.exec(url.hostname);
  if (directHostMatch?.[1]) return directHostMatch[1];

  const poolerUserMatch = /^postgres\.([a-z0-9]+)$/u.exec(decodeURIComponent(url.username));
  return poolerUserMatch?.[1] ?? null;
}

export function buildClientDemoPlan(input: BuildClientDemoPlanInput): ClientDemoPlan {
  const emailDomain = normaliseEmailDomain(input.emailDomain);
  const password = requireDemoPassword(input.password);

  return {
    emailDomain,
    users: [
      {
        id: 'clientdemo_user_head_parent',
        role: 'Head',
        email: `head-parent@${emailDomain}`,
        fullName: 'Harriet Demo Head',
        password,
        tags: ['parent-message-responder', 'finance-admin', 'leaderboard-admin'],
        linkedAsGuardian: true,
      },
      {
        id: 'clientdemo_user_parent',
        role: 'Parent',
        email: `parent@${emailDomain}`,
        fullName: 'Priya Demo Parent',
        password,
        tags: [],
        linkedAsGuardian: true,
      },
      {
        id: 'clientdemo_user_pastor',
        role: 'Pastor',
        email: `pastor@${emailDomain}`,
        fullName: 'Peter Demo Pastor',
        password,
        tags: ['leaderboard-admin'],
      },
      {
        id: 'clientdemo_user_supervisor',
        role: 'Supervisor',
        email: `supervisor@${emailDomain}`,
        fullName: 'Sam Demo Supervisor',
        password,
        tags: ['attendance-recorder', 'parent-message-responder', 'supervisor-all-students'],
      },
      {
        id: 'clientdemo_user_shopkeeper',
        role: 'Supervisor',
        email: `shopkeeper@${emailDomain}`,
        fullName: 'Shona Demo Shopkeeper',
        password,
        tags: ['shopkeeper', 'shopadmin'],
      },
      {
        id: 'clientdemo_user_clubs_admin',
        role: 'ClubsAdmin',
        email: `clubs-admin@${emailDomain}`,
        fullName: 'Caleb Demo Clubs',
        password,
        tags: [],
      },
      {
        id: 'clientdemo_user_clubs_lead',
        role: 'ClubsLead',
        email: `clubs-lead@${emailDomain}`,
        fullName: 'Lena Demo Lead',
        password,
        tags: [],
      },
      {
        id: 'clientdemo_user_student',
        role: 'Student',
        email: `student@${emailDomain}`,
        fullName: 'Ava Demo Student',
        password,
        tags: [],
      },
      {
        id: 'clientdemo_user_student_secondary',
        role: 'Student',
        email: `student-sibling@${emailDomain}`,
        fullName: 'Noah Demo Student',
        password,
        tags: [],
      },
    ],
    students: [
      {
        id: 'clientdemo_student_primary',
        userId: 'clientdemo_user_student',
        fullName: 'Ava Demo Student',
        dob: '2013-09-12',
        address: '12 Demo Crescent, Birmingham B1 1AA',
        yearGroup: 'Y7',
        enrolmentDate: '2025-09-02',
      },
      {
        id: 'clientdemo_student_sibling',
        userId: 'clientdemo_user_student_secondary',
        fullName: 'Noah Demo Student',
        dob: '2015-04-20',
        address: '12 Demo Crescent, Birmingham B1 1AA',
        yearGroup: 'Y5',
        enrolmentDate: '2025-09-02',
      },
    ],
    coverage: [
      'linked head-parent access',
      'parent portal child overview',
      'pastor pastoral view',
      'student portal login',
      'attendance',
      'pace and subjects',
      'behaviour and merits',
      'homework',
      'staff notices',
      'parent-staff messaging',
      'clubs',
      'shop reservations',
      'school fees',
      'permission slips',
      'incident parent copies',
      'faith corner',
      'student community',
      'term reports',
    ],
  };
}

function normaliseEmailDomain(rawDomain: string): string {
  const emailDomain = rawDomain.trim().toLowerCase();
  if (!emailDomain || emailDomain.includes('@') || emailDomain.includes('/')) {
    throw new Error('OASIS_CLIENT_DEMO_EMAIL_DOMAIN must be a domain such as demo.example.com.');
  }
  if (!emailDomain.includes('demo') && emailDomain !== 'localhost') {
    throw new Error('OASIS_CLIENT_DEMO_EMAIL_DOMAIN must identify a demo-only email domain.');
  }
  return emailDomain;
}

function requireDemoPassword(password: string): string {
  if (password.length < 12 || password.length > 128) {
    throw new Error('OASIS_CLIENT_DEMO_PASSWORD must be between 12 and 128 characters.');
  }
  return password;
}
