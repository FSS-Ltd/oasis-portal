# Daily Tech Debt Review Current Pass

- Current pass: 1
- Pass started: 2026-05-27
- Eligible files at pass start: 389
- Current eligible files detected: 516
- Files reviewed so far: 80
- Files remaining estimate: 436
- Last run: 2026-06-08
- Next selection strategy: continue pass 1 by selecting 10 unreviewed oversized production source files first; prioritise UI files over 300 lines and backend/domain utilities over 400 lines, then high-churn files.

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
13. `apps/api/src/routers/incident.ts`
14. `apps/api/src/routers/investment.ts`
15. `apps/api/src/routers/invoice.ts`
16. `apps/api/src/routers/leaderboard.ts`
17. `apps/api/src/routers/meritLedger.ts`
18. `apps/api/src/routers/message.ts`
19. `apps/api/src/routers/notice.ts`
20. `apps/api/src/routers/pace.ts`
21. `apps/api/src/routers/permissionSlip.ts`
22. `apps/api/src/routers/profile.ts`
23. `apps/api/src/routers/registration.ts`
24. `apps/api/src/routers/report.ts`
25. `apps/api/src/routers/rota.ts`
26. `apps/api/src/routers/shop.ts`
27. `apps/api/src/routers/student.ts`
28. `apps/api/src/routers/studentSettings.ts`
29. `apps/api/src/services/market-data/twelve-data-refresh.ts`
30. `apps/mobile/src/components/smoke/parent-smoke-children.tsx`
31. `apps/mobile/src/components/smoke/portal-mobile-shell.tsx`
32. `apps/mobile/src/components/smoke/student-portal-smoke-screen.tsx`
33. `apps/mobile/src/components/smoke/student-smoke-shop.tsx`
34. `apps/mobile/src/components/smoke/supervisor-smoke-screen.tsx`
35. `apps/web/src/app/(admin)/admin/academic/academic-settings-client.tsx`
36. `apps/web/src/app/(admin)/admin/audit/audit-log-viewer.tsx`
37. `apps/web/src/app/(admin)/admin/rota/rota-scheduler-client.tsx`
38. `apps/web/src/app/(admin)/admin/staff/_components/user-profile-panel.tsx`
39. `apps/web/src/app/(admin)/admin/student-portal/student-portal-readiness-client.tsx`
40. `apps/web/src/app/(admin)/admin/students/[id]/student-admin-editor.tsx`
41. `apps/web/src/app/(parent)/parent/parent-dashboard-client.tsx`
42. `apps/web/src/app/(parent)/parent/registration/sibling-add-modal.tsx`
43. `apps/web/src/app/(supervisor)/supervisor/_components/supervisor-dashboard-overview.tsx`
44. `apps/web/src/app/(supervisor)/supervisor/supervisor-dashboard-client.tsx`
45. `apps/web/src/app/landing-page.tsx`
46. `apps/web/src/app/registration/registration-form-model.ts`
47. `apps/web/src/app/registration/registration-form.tsx`
48. `apps/web/src/components/attendance/attendance-capture.tsx`
49. `apps/web/src/components/behaviour/behaviour-log-client.tsx`
50. `apps/web/src/components/calendar/shared-calendar.tsx`
51. `apps/web/src/components/child-log/child-snapshot-client.tsx`
52. `apps/web/src/components/clubs/club-rota-panel.tsx`
53. `apps/web/src/components/clubs/clubs-lead-portal-client.tsx`
54. `apps/web/src/components/clubs/parent-my-clubs-client.tsx`
55. `apps/web/src/components/incidents/incident-staff-workflow.tsx`
56. `apps/web/src/components/invoices/admin-invoice-create-modal.tsx`
57. `apps/web/src/components/invoices/admin-invoice-upload-modal.tsx`
58. `apps/web/src/components/invoices/admin-invoices-client.tsx`
59. `apps/web/src/components/leaderboard/leaderboard-client.tsx`
60. `apps/web/src/components/messages/message-centre.tsx`
61. `apps/web/src/components/noticeboard/staff-noticeboard.tsx`
62. `apps/web/src/components/parent/parent-student-settings-client.tsx`
63. `apps/web/src/components/permission-slips/admin-permission-slip-form.tsx`
64. `apps/web/src/components/permission-slips/admin-permission-slips-client.tsx`
65. `apps/web/src/components/permission-slips/parent-permission-slips-client.tsx`
66. `apps/web/src/components/shop/parent-shop-client.tsx`
67. `apps/web/src/components/shop/shop-workflow-client.tsx`
68. `apps/web/src/components/student-drillthrough/student-drillthrough-content.tsx`
69. `apps/web/src/components/student/invest/student-invest-data.ts`
70. `apps/web/src/components/student/invest/student-invest-market.tsx`
71. `apps/web/src/components/student/invest/student-invest-overview.tsx`
72. `apps/web/src/components/student/invest/student-invest-ui.tsx`
73. `apps/web/src/components/student/student-wallet-client.tsx`
74. `packages/db/src/pace-score-backfill.ts`
75. `packages/domain/src/investmentMarketData.ts`
76. `packages/domain/src/invoice.ts`
77. `packages/domain/src/rbac.ts`
78. `packages/domain/src/shop.ts`
79. `packages/domain/src/studentPortalSettings.ts`
80. `packages/domain/src/tithe.ts`
