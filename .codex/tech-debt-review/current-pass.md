# Daily Tech Debt Review Current Pass

- Current pass: 1
- Pass started: 2026-05-27
- Eligible files at pass start: 389
- Current eligible files detected: 530
- Files reviewed so far: 100
- Files remaining estimate: 430
- Last run: 2026-06-11
- Next selection strategy: continue pass 1 by selecting 10 unreviewed production source files; prioritise files with lint/type errors first, then oversized React components over 300 lines and backend/domain utilities over 400 lines.

## Reviewed This Pass

1. `apps/api/src/incidents/incident-report-pdf.ts`
2. `apps/api/src/invoices/school-fee-pdf.ts`
3. `apps/api/src/lib/email.ts`
4. `apps/api/src/lib/student-portal-access.ts`
5. `apps/api/src/routers/admin.ts`
6. `apps/api/src/routers/attendance.ts`
7. `apps/api/src/routers/behaviour.ts`
8. `apps/api/src/routers/calendar.ts`
9. `apps/api/src/routers/childLog.ts`
10. `apps/api/src/routers/childNotes.ts`
11. `apps/api/src/routers/clerkWebhook.ts`
12. `apps/api/src/routers/club.ts`
13. `apps/api/src/routers/faithCorner.ts`
14. `apps/api/src/routers/homework.ts`
15. `apps/api/src/routers/incident.ts`
16. `apps/api/src/routers/investment.ts`
17. `apps/api/src/routers/invoice.ts`
18. `apps/api/src/routers/leaderboard.ts`
19. `apps/api/src/routers/meritLedger.ts`
20. `apps/api/src/routers/message.ts`
21. `apps/api/src/routers/notice.ts`
22. `apps/api/src/routers/pace.ts`
23. `apps/api/src/routers/permissionSlip.ts`
24. `apps/api/src/routers/profile.ts`
25. `apps/api/src/routers/registration.ts`
26. `apps/api/src/routers/report.ts`
27. `apps/api/src/routers/rota.ts`
28. `apps/api/src/routers/shop.ts`
29. `apps/api/src/routers/student.ts`
30. `apps/api/src/routers/studentSettings.ts`
31. `apps/api/src/services/market-data/twelve-data-refresh.ts`
32. `apps/mobile/src/components/smoke/parent-message-conversation.tsx`
33. `apps/mobile/src/components/smoke/parent-portal-smoke-screen.tsx`
34. `apps/mobile/src/components/smoke/parent-smoke-children.tsx`
35. `apps/mobile/src/components/smoke/portal-mobile-shell.tsx`
36. `apps/mobile/src/components/smoke/sign-in-panel.tsx`
37. `apps/mobile/src/components/smoke/student-portal-smoke-screen.tsx`
38. `apps/mobile/src/components/smoke/student-smoke-shop.tsx`
39. `apps/mobile/src/components/smoke/student-smoke-wallet.tsx`
40. `apps/mobile/src/components/smoke/supervisor-smoke-screen.tsx`
41. `apps/web/src/app/(admin)/admin/academic/academic-settings-client.tsx`
42. `apps/web/src/app/(admin)/admin/access/access-account-panel.tsx`
43. `apps/web/src/app/(admin)/admin/attendance/staff-attendance-roster.tsx`
44. `apps/web/src/app/(admin)/admin/audit/audit-log-viewer.tsx`
45. `apps/web/src/app/(admin)/admin/rota/rota-scheduler-client.tsx`
46. `apps/web/src/app/(admin)/admin/staff/_components/user-profile-panel.tsx`
47. `apps/web/src/app/(admin)/admin/student-portal/student-portal-readiness-client.tsx`
48. `apps/web/src/app/(admin)/admin/students/[id]/student-admin-editor.tsx`
49. `apps/web/src/app/(parent)/parent/parent-dashboard-client.tsx`
50. `apps/web/src/app/(parent)/parent/registration/sibling-add-modal.tsx`
51. `apps/web/src/app/(supervisor)/supervisor/_components/supervisor-dashboard-overview.tsx`
52. `apps/web/src/app/(supervisor)/supervisor/supervisor-dashboard-client.tsx`
53. `apps/web/src/app/landing-page.tsx`
54. `apps/web/src/app/registration/registration-form-model.ts`
55. `apps/web/src/app/registration/registration-form.tsx`
56. `apps/web/src/components/attendance/attendance-capture.tsx`
57. `apps/web/src/components/attendance/special-attendance-capture.tsx`
58. `apps/web/src/components/behaviour/behaviour-log-client.tsx`
59. `apps/web/src/components/calendar/shared-calendar.tsx`
60. `apps/web/src/components/child-log/child-snapshot-client.tsx`
61. `apps/web/src/components/clubs/club-assignment-panels.tsx`
62. `apps/web/src/components/clubs/club-management-detail.tsx`
63. `apps/web/src/components/clubs/club-rota-panel.tsx`
64. `apps/web/src/components/clubs/clubs-lead-portal-client.tsx`
65. `apps/web/src/components/clubs/my-club-rota-panel.tsx`
66. `apps/web/src/components/clubs/parent-my-clubs-client.tsx`
67. `apps/web/src/components/homework/admin-homework-client.tsx`
68. `apps/web/src/components/incidents/incident-parent-portal.tsx`
69. `apps/web/src/components/incidents/incident-staff-workflow.tsx`
70. `apps/web/src/components/invoices/admin-invoice-create-modal.tsx`
71. `apps/web/src/components/invoices/admin-invoice-upload-modal.tsx`
72. `apps/web/src/components/invoices/admin-invoice-upload-utils.ts`
73. `apps/web/src/components/invoices/admin-invoices-client.tsx`
74. `apps/web/src/components/invoices/parent-fees-client.tsx`
75. `apps/web/src/components/leaderboard/leaderboard-client.tsx`
76. `apps/web/src/components/messages/message-centre.tsx`
77. `apps/web/src/components/noticeboard/noticeboard-attachments.tsx`
78. `apps/web/src/components/noticeboard/staff-noticeboard.tsx`
79. `apps/web/src/components/pace/pace-workflow-client.tsx`
80. `apps/web/src/components/parent/parent-student-settings-client.tsx`
81. `apps/web/src/components/permission-slips/admin-permission-slip-form.tsx`
82. `apps/web/src/components/permission-slips/admin-permission-slips-client.tsx`
83. `apps/web/src/components/permission-slips/parent-permission-slips-client.tsx`
84. `apps/web/src/components/profile/self-profile-client.tsx`
85. `apps/web/src/components/reports/report-workflow-client.tsx`
86. `apps/web/src/components/shop/parent-shop-client.tsx`
87. `apps/web/src/components/shop/shop-workflow-client.tsx`
88. `apps/web/src/components/student-drillthrough/student-drillthrough-content.tsx`
89. `apps/web/src/components/student/invest/student-invest-data.ts`
90. `apps/web/src/components/student/invest/student-invest-market.tsx`
91. `apps/web/src/components/student/invest/student-invest-overview.tsx`
92. `apps/web/src/components/student/invest/student-invest-ui.tsx`
93. `apps/web/src/components/student/student-wallet-client.tsx`
94. `packages/db/src/pace-score-backfill.ts`
95. `packages/domain/src/investmentMarketData.ts`
96. `packages/domain/src/invoice.ts`
97. `packages/domain/src/rbac.ts`
98. `packages/domain/src/shop.ts`
99. `packages/domain/src/studentPortalSettings.ts`
100. `packages/domain/src/tithe.ts`
