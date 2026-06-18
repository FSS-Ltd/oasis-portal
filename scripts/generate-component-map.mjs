#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const GRAPH_PATH = path.join(ROOT, 'graphify-out/graph.json');
const DOC_PATH = path.join(ROOT, 'docs/architecture/component-relationships.md');
const START_MARKER = '<!-- COMPONENT_MAP:START -->';
const END_MARKER = '<!-- COMPONENT_MAP:END -->';

const PRODUCT_MODULES = [
  {
    name: 'Identity, Clerk sync, sessions, and post-sign-in routing',
    owns: 'Authentication handoff, Clerk webhook sync, session context, MFA flow, and portal routing after sign-in.',
    apiRouters: ['clerkWebhook', 'health'],
    domainFiles: ['packages/domain/src/users.ts', 'packages/domain/src/rbac.ts'],
    webSurfaces: [
      'apps/web/src/app/(auth)/',
      'apps/web/src/app/children-check/',
      'apps/web/src/app/not-ready/',
      'apps/web/src/app/post-sign-in/',
      'apps/web/src/components/auth/',
      'apps/web/src/middleware.ts',
    ],
    mobileSurfaces: [
      'apps/mobile/app/_layout.tsx',
      'apps/mobile/app/index.tsx',
      'apps/mobile/app/sso-callback.tsx',
    ],
    sharedSurfaces: [
      'apps/api/src/context.ts',
      'apps/api/src/lib/',
      'apps/web/src/components/providers/',
    ],
  },
  {
    name: 'RBAC, permission tags, and access boundaries',
    owns: 'Role checks, permission tags, workflow gates, access denied handling, and scope decisions.',
    apiRouters: ['admin', 'audit'],
    domainFiles: ['packages/domain/src/rbac.ts', 'packages/domain/src/leaderboard.ts'],
    webSurfaces: ['apps/web/src/components/admin/require-full-admin.tsx'],
    mobileSurfaces: [],
    sharedSurfaces: [
      'apps/api/src/context.ts',
      'docs/adr/0003-sensitive-visibility-rbac-plus-rls.md',
    ],
  },
  {
    name: 'Admin access, users, invitations, audit, and profiles',
    owns: 'Admin shell, user access, invitations, account lifecycle, audit views, and profile administration.',
    apiRouters: ['admin', 'audit', 'profile', 'student'],
    domainFiles: ['packages/domain/src/users.ts', 'packages/domain/src/rbac.ts'],
    webSurfaces: [
      'apps/web/src/app/(admin)/',
      'apps/web/src/components/admin/',
      'apps/web/src/components/profile/',
    ],
    mobileSurfaces: [],
    sharedSurfaces: ['apps/web/src/components/ui/'],
  },
  {
    name: 'Attendance and rota workflows',
    owns: 'Attendance capture, export, historical attendance, staff rota, and rota validation.',
    apiRouters: ['attendance', 'rota'],
    domainFiles: ['packages/domain/src/rbac.ts'],
    webSurfaces: [
      'apps/web/src/components/attendance/',
      'apps/web/src/components/rota/',
      'apps/web/src/components/student-drillthrough/attendance-calendar.tsx',
    ],
    mobileSurfaces: [
      'apps/mobile/src/components/smoke/',
      'apps/mobile/src/components/staff/staff-rota-availability-panel.tsx',
      'apps/mobile/src/components/staff/staff-rota-common.tsx',
      'apps/mobile/src/components/staff/staff-rota-rota-panel.tsx',
      'apps/mobile/src/components/staff/staff-rota-screen.tsx',
      'apps/mobile/src/components/staff/staff-rota-swap-panel.tsx',
      'apps/mobile/src/components/staff/staff-rota-utils.ts',
    ],
    sharedSurfaces: ['apps/web/src/components/ui/'],
  },
  {
    name: 'Behaviour, merits, demerits, leaderboard, and child notes',
    owns: 'Behaviour logging, sensitive behaviour visibility, child notes, merit ledger rows, leaderboards, and the charity pot goal.',
    apiRouters: ['behaviour', 'childLog', 'childNotes', 'leaderboard', 'meritLedger'],
    domainFiles: [
      'packages/domain/src/leaderboard.ts',
      'packages/domain/src/meritLedger.ts',
      'packages/domain/src/rbac.ts',
    ],
    webSurfaces: [
      'apps/web/src/components/behaviour/',
      'apps/web/src/components/child-log/',
      'apps/web/src/components/leaderboard/',
      'apps/web/src/components/student-drillthrough/notes-list.tsx',
    ],
    mobileSurfaces: ['apps/mobile/src/components/smoke/'],
    sharedSurfaces: ['apps/web/src/components/ui/'],
  },
  {
    name: 'Incident reports, staff review, and parent-safe release',
    owns: 'Incident recording, head sign-off, escalation review, encrypted parent copies, guardian release, acknowledgements, and PDF downloads.',
    apiRouters: ['incident'],
    domainFiles: ['packages/domain/src/incidents.ts'],
    webSurfaces: [
      'apps/web/src/app/(admin)/admin/incidents/',
      'apps/web/src/app/(supervisor)/supervisor/incidents/',
      'apps/web/src/app/(parent)/parent/incidents/',
      'apps/web/src/app/api/incidents/',
      'apps/web/src/components/incidents/',
    ],
    mobileSurfaces: [],
    sharedSurfaces: [
      'apps/api/src/incidents/',
      'packages/db/prisma/migrations/20260528160000_incident_reports/',
    ],
  },
  {
    name: 'PACE, subjects, school years, and academic progress',
    owns: 'PACE workflow, academic year rules, subject helpers, score entry, and progress display.',
    apiRouters: ['pace'],
    domainFiles: ['packages/domain/src/schoolYears.ts', 'packages/domain/src/subjects.ts'],
    webSurfaces: ['apps/web/src/components/pace/'],
    mobileSurfaces: ['apps/mobile/src/components/smoke/'],
    sharedSurfaces: ['apps/web/src/components/ui/'],
  },
  {
    name: 'Registration, parent, student, supervisor, and admin shells',
    owns: 'Portal shells, registration form flow, role-specific navigation, and cross-role dashboard entry points.',
    apiRouters: ['registration', 'student', 'studentSettings', 'profile', 'staffHome'],
    domainFiles: [
      'packages/domain/src/registration.ts',
      'packages/domain/src/studentPortalSettings.ts',
      'packages/domain/src/users.ts',
      'packages/domain/src/rbac.ts',
    ],
    webSurfaces: [
      'apps/web/src/app/(admin)/',
      'apps/web/src/app/(clubs-lead)/',
      'apps/web/src/app/(parent)/',
      'apps/web/src/app/(student)/',
      'apps/web/src/app/(supervisor)/',
      'apps/web/src/app/registration/',
      'apps/web/src/components/navigation/',
      'apps/web/src/components/student/',
      'apps/web/src/components/supervisor/',
    ],
    mobileSurfaces: [
      'apps/mobile/app/',
      'apps/mobile/src/components/',
      'apps/mobile/src/components/staff/',
    ],
    sharedSurfaces: [
      'apps/api/src/lib/student-portal-access.ts',
      'apps/web/src/components/ui/',
      'packages/db/prisma/migrations/20260603211500_student_portal_usage_minutes/',
    ],
  },
  {
    name: 'Faith Corner managed student content',
    owns: 'Managed weekly Scripture memory, reflection prompts, optional verse-of-day content, and read-only student Faith Corner views.',
    apiRouters: ['faithCorner'],
    domainFiles: [],
    webSurfaces: [
      'apps/web/src/app/(admin)/admin/faith-corner/',
      'apps/web/src/app/(student)/student/faith/',
      'apps/web/src/components/faith-corner/',
      'apps/web/src/components/student/',
    ],
    mobileSurfaces: [],
    sharedSurfaces: [
      'apps/api/src/services/faith-corner.ts',
      'packages/db/prisma/migrations/20260604034500_faith_corner_content/',
    ],
  },
  {
    name: 'Student notification centre and announcements',
    owns: 'Student-targeted in-app notifications, unread state, manager announcements, and event-created student updates.',
    apiRouters: ['studentNotification'],
    domainFiles: [],
    webSurfaces: [
      'apps/web/src/app/(admin)/admin/student-notifications/',
      'apps/web/src/app/(student)/student/notifications/',
      'apps/web/src/components/student-notifications/',
      'apps/web/src/components/student/',
    ],
    mobileSurfaces: [],
    sharedSurfaces: [
      'apps/api/src/services/student-notifications.ts',
      'packages/db/prisma/migrations/20260604052000_student_notifications/',
    ],
  },
  {
    name: 'Homework assignments, submissions, and review',
    owns: 'Head-created homework assignments, age-band targeting, student image submissions, in-person evidence uploads, review comments, scores, and linked homework merit awards.',
    apiRouters: ['homework'],
    domainFiles: ['packages/domain/src/schoolYears.ts', 'packages/domain/src/meritLedger.ts'],
    webSurfaces: [
      'apps/web/src/app/(admin)/admin/homework/',
      'apps/web/src/app/(student)/student/homework/',
      'apps/web/src/app/api/homework/',
      'apps/web/src/components/homework/',
      'apps/web/src/components/admin/admin-nav.tsx',
      'apps/web/src/components/student/student-nav.tsx',
    ],
    mobileSurfaces: [],
    sharedSurfaces: [
      'apps/api/src/services/homework-submission-storage.ts',
      'packages/db/prisma/migrations/20260609111500_homework_portal/',
    ],
  },
  {
    name: 'Student community messaging and moderation',
    owns: 'Student community groups, central all-student chat, text-only messages, read receipts, group membership, and full-admin moderation controls.',
    apiRouters: ['community'],
    domainFiles: ['packages/domain/src/rbac.ts'],
    webSurfaces: [
      'apps/web/src/app/(admin)/admin/community/',
      'apps/web/src/app/(student)/student/community/',
      'apps/web/src/components/community/',
      'apps/web/src/components/admin/admin-nav.tsx',
      'apps/web/src/components/student/student-nav.tsx',
    ],
    mobileSurfaces: [],
    sharedSurfaces: [
      'apps/web/src/components/providers/realtime-provider.tsx',
      'apps/web/src/lib/realtime/events.ts',
      'packages/db/prisma/migrations/20260612180000_student_community/',
    ],
  },
  {
    name: 'Shop, invoices, clubs, calendar, tithe, savings, investment, reports, notices, messages, and email',
    owns: 'Commercial, wallet, finance, calendar, and communication workflows that hang off student, parent, staff, and admin experiences.',
    apiRouters: [
      'shop',
      'invoice',
      'permissionSlip',
      'club',
      'calendar',
      'tithe',
      'investment',
      'report',
      'notice',
      'message',
      'email',
    ],
    domainFiles: [
      'packages/domain/src/clubs.ts',
      'packages/domain/src/investmentMarketData.ts',
      'packages/domain/src/investmentSim.ts',
      'packages/domain/src/investmentTransactions.ts',
      'packages/domain/src/invoice.ts',
      'packages/domain/src/permissionSlips.ts',
      'packages/domain/src/report.ts',
      'packages/domain/src/savings.ts',
      'packages/domain/src/shop.ts',
      'packages/domain/src/tithe.ts',
    ],
    webSurfaces: [
      'apps/web/src/app/(admin)/',
      'apps/web/src/app/(clubs-lead)/',
      'apps/web/src/app/(supervisor)/supervisor/shop/',
      'apps/web/src/app/(parent)/',
      'apps/web/src/app/(student)/student/messages/',
      'apps/web/src/components/calendar/',
      'apps/web/src/components/clubs/',
      'apps/web/src/components/invoices/',
      'apps/web/src/components/messages/',
      'apps/web/src/components/permission-slips/',
      'apps/web/src/components/noticeboard/',
      'apps/web/src/components/reports/',
      'apps/web/src/components/shop/',
      'apps/web/src/components/ui/',
    ],
    mobileSurfaces: [
      'apps/mobile/src/components/smoke/parent-portal-smoke-screen.tsx',
      'apps/mobile/src/components/smoke/parent-smoke-messages.tsx',
      'apps/mobile/src/components/smoke/parent-smoke-notices.tsx',
      'apps/mobile/src/components/smoke/student-portal-smoke-screen.tsx',
      'apps/mobile/src/components/staff/staff-communications-screen.tsx',
      'apps/mobile/src/components/staff/staff-notices-panel.tsx',
    ],
    sharedSurfaces: [
      'apps/api/src/emails/',
      'apps/api/src/services/market-data/',
      'apps/api/src/services/savings-interest.ts',
      'packages/db/prisma/migrations/20260606160000_investment_market_snapshots/',
      'packages/db/prisma/migrations/20260606163000_add_requested_lse_etfs/',
      'packages/db/prisma/migrations/20260616120000_student_direct_messages/',
    ],
  },
  {
    name: 'Shared UI primitives and cross-app tRPC clients',
    owns: 'Reusable UI primitives, tRPC providers, typed clients, mobile smoke primitives, and cross-app client plumbing.',
    apiRouters: [],
    domainFiles: ['packages/ui/src/index.ts'],
    webSurfaces: [
      'apps/web/src/components/ui/',
      'apps/web/src/components/providers/',
      'apps/web/src/lib/',
    ],
    mobileSurfaces: [
      'apps/mobile/src/components/',
      'apps/mobile/src/lib/',
      'apps/mobile/src/types/',
    ],
    sharedSurfaces: ['apps/api/src/router.ts', 'apps/api/src/trpc.ts'],
  },
  {
    name: 'Database, RLS, encryption, and Supabase/Postgres support',
    owns: 'Database connection setup, Prisma helpers, RLS smoke checks, encryption, blind indexes, and migration support scripts.',
    apiRouters: [],
    domainFiles: [],
    webSurfaces: ['apps/web/src/lib/supabase/'],
    mobileSurfaces: [],
    sharedSurfaces: [
      'packages/db/src/',
      'packages/db/scripts/',
      'packages/db/prisma/',
      'docs/adr/0006-pii-envelope-encryption-env-key.md',
    ],
  },
];

const formatPath = (value) => `\`${value}\``;

const normalizePath = (value) => String(value ?? '').replaceAll(path.sep, '/');

const routerPath = (routerName) => `apps/api/src/routers/${routerName}.ts`;

const modulePatterns = (module) => [
  ...module.apiRouters.map(routerPath),
  ...module.domainFiles,
  ...module.webSurfaces,
  ...module.mobileSurfaces,
  ...module.sharedSurfaces,
];

const matchesPattern = (sourceFile, pattern) => {
  const file = normalizePath(sourceFile);
  const normalizedPattern = normalizePath(pattern);

  if (!file || !normalizedPattern) {
    return false;
  }

  if (normalizedPattern.endsWith('/')) {
    return file.startsWith(normalizedPattern);
  }

  return file === normalizedPattern || file.startsWith(`${normalizedPattern}/`);
};

const fileMatchesModule = (sourceFile, module) =>
  modulePatterns(module).some((pattern) => matchesPattern(sourceFile, pattern));

const uniqueSorted = (values) =>
  [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));

const uniqueSortedNumbers = (values) =>
  [...new Set(values.filter((value) => value !== undefined && value !== null))].sort(
    (a, b) => Number(a) - Number(b),
  );

const listItems = (values) => {
  const items = uniqueSorted(values);
  return items.length > 0 ? items.map(formatPath) : ['_None configured_'];
};

const formatCountMap = (countMap) => {
  const entries = [...countMap.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entries.length > 0 ? entries.map(([key, count]) => `${key}: ${count}`).join(', ') : 'none';
};

const findModulesForFiles = (files) =>
  PRODUCT_MODULES.filter((module) =>
    files.some((sourceFile) => fileMatchesModule(sourceFile, module)),
  ).map((module) => module.name);

const edgeEndpointFiles = (link, nodeById) => {
  const endpointIds = [link.source, link.target, link._src, link._tgt].filter(Boolean);
  return endpointIds.map((id) => nodeById.get(id)?.source_file).filter(Boolean);
};

const buildModuleSummaries = (graph) => {
  const nodes = graph.nodes ?? [];
  const links = graph.links ?? graph.edges ?? [];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  return PRODUCT_MODULES.map((module) => {
    const matchedNodes = nodes.filter((node) => fileMatchesModule(node.source_file, module));
    const matchedNodeIds = new Set(matchedNodes.map((node) => node.id));
    const matchedLinks = [];
    const relatedModules = new Map();
    const relationCounts = new Map();
    const confidenceCounts = new Map();

    for (const link of links) {
      const files = uniqueSorted([link.source_file, ...edgeEndpointFiles(link, nodeById)]);
      const endpointIds = [link.source, link.target, link._src, link._tgt].filter(Boolean);
      const directlyMatchesModule =
        files.some((sourceFile) => fileMatchesModule(sourceFile, module)) ||
        endpointIds.some((id) => matchedNodeIds.has(id));

      if (!directlyMatchesModule) {
        continue;
      }

      matchedLinks.push(link);
      relationCounts.set(link.relation, (relationCounts.get(link.relation) ?? 0) + 1);
      confidenceCounts.set(link.confidence, (confidenceCounts.get(link.confidence) ?? 0) + 1);

      for (const relatedName of findModulesForFiles(files)) {
        if (relatedName !== module.name) {
          relatedModules.set(relatedName, (relatedModules.get(relatedName) ?? 0) + 1);
        }
      }
    }

    return {
      module,
      nodeCount: matchedNodes.length,
      linkCount: matchedLinks.length,
      communities: uniqueSortedNumbers(matchedNodes.map((node) => node.community)).slice(0, 8),
      relationCounts,
      confidenceCounts,
      relatedModules,
    };
  });
};

const relatedModuleItems = (relatedModules) => {
  const entries = [...relatedModules.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5);

  return entries.length > 0
    ? entries.map(([name, count]) => `${name} (${count})`)
    : ['No cross-module graph edges matched configured paths'];
};

const pushList = (lines, label, values) => {
  lines.push(`- ${label}:`);

  for (const item of listItems(values)) {
    lines.push(`  - ${item}`);
  }
};

const pushPlainList = (lines, label, values) => {
  lines.push(`- ${label}:`);

  for (const item of values) {
    lines.push(`  - ${item}`);
  }
};

const buildGeneratedSection = (graph) => {
  const links = graph.links ?? graph.edges ?? [];
  const summaries = buildModuleSummaries(graph);
  const lines = [
    START_MARKER,
    '',
    '## Generated Module Relationship Map',
    '',
    `Generated from ${formatPath('graphify-out/graph.json')} with ${graph.nodes?.length ?? 0} graph nodes and ${links.length} graph links.`,
    '',
    'Graph confidence labels are preserved so agents can distinguish extracted code relationships from inferred relationships.',
    '',
  ];

  for (const summary of summaries) {
    const { module } = summary;
    lines.push(`### ${module.name}`);
    lines.push('');
    lines.push(`- Owns: ${module.owns}`);
    pushList(lines, 'API routers', module.apiRouters.map(routerPath));
    pushList(lines, 'Domain helpers', module.domainFiles);
    pushList(lines, 'Web surfaces', module.webSurfaces);
    pushList(lines, 'Mobile surfaces', module.mobileSurfaces);
    pushList(lines, 'Shared or infrastructure surfaces', module.sharedSurfaces);
    lines.push(
      `- Graphify evidence: ${summary.nodeCount} nodes, ${summary.linkCount} links, communities ${summary.communities.length > 0 ? summary.communities.join(', ') : 'none'}.`,
    );
    lines.push(`- Relationship types: ${formatCountMap(summary.relationCounts)}.`);
    lines.push(`- Confidence mix: ${formatCountMap(summary.confidenceCounts)}.`);
    pushPlainList(lines, 'Connected modules', relatedModuleItems(summary.relatedModules));
    lines.push('');
  }

  lines.push(END_MARKER);
  return lines.join('\n');
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const main = async () => {
  const [graphText, docText] = await Promise.all([
    readFile(GRAPH_PATH, 'utf8'),
    readFile(DOC_PATH, 'utf8'),
  ]);
  const graph = JSON.parse(graphText);

  if (!docText.includes(START_MARKER) || !docText.includes(END_MARKER)) {
    throw new Error(`Missing generated section markers in ${DOC_PATH}`);
  }

  const generatedSection = buildGeneratedSection(graph);
  const markerPattern = new RegExp(
    `${escapeRegExp(START_MARKER)}[\\s\\S]*${escapeRegExp(END_MARKER)}`,
  );
  const updatedDoc = docText.replace(markerPattern, generatedSection);

  await writeFile(DOC_PATH, `${updatedDoc.trimEnd()}\n`);
  console.log(`Updated ${path.relative(ROOT, DOC_PATH)}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
