'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Route } from 'next';
import { ActiveScoreKeysReport } from './active-score-keys-report';
import { ReportWorkflowClient } from './report-workflow-client';
import styles from './reports-workspace.module.css';

type ReportTab = 'student-reports' | 'score-keys';

export function ReportsWorkspaceClient({
  canViewStudentReports,
}: {
  canViewStudentReports: boolean;
}) {
  const pathname = usePathname() ?? '/admin/reports';
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabs: readonly ReportTab[] = canViewStudentReports
    ? ['student-reports', 'score-keys']
    : ['score-keys'];
  const requestedTab = searchParams?.get('tab');
  const [selectedTab, setSelectedTab] = useState<ReportTab>(() =>
    canViewStudentReports && requestedTab === 'score-keys' ? 'score-keys' : 'student-reports',
  );
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeTab: ReportTab = canViewStudentReports ? selectedTab : 'score-keys';

  useEffect(() => {
    if (!canViewStudentReports) return;
    setSelectedTab(requestedTab === 'score-keys' ? 'score-keys' : 'student-reports');
  }, [canViewStudentReports, requestedTab]);

  function selectTab(tab: ReportTab, focusIndex?: number) {
    if (!tabs.includes(tab)) return;
    setSelectedTab(tab);
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('tab', tab);
    router.replace(`${pathname}?${params.toString()}` as Route, { scroll: false });
    if (focusIndex !== undefined) tabRefs.current[focusIndex]?.focus();
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = tabs.indexOf(activeTab);
    const nextIndex =
      event.key === 'ArrowRight'
        ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft'
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : -1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextTab = tabs[nextIndex];
    if (nextTab) selectTab(nextTab, nextIndex);
  }

  return (
    <div className={styles.workspace}>
      {canViewStudentReports ? (
        <div aria-label="Report sections" className={styles.tabs} role="tablist">
          <button
            aria-controls="student-reports-panel"
            aria-selected={activeTab === 'student-reports'}
            className={activeTab === 'student-reports' ? styles.selected : ''}
            id="student-reports-tab"
            onClick={() => {
              selectTab('student-reports');
            }}
            onKeyDown={onTabKeyDown}
            ref={(element) => {
              tabRefs.current[0] = element;
            }}
            role="tab"
            tabIndex={activeTab === 'student-reports' ? 0 : -1}
            type="button"
          >
            Student Reports
          </button>
          <button
            aria-controls="score-keys-panel"
            aria-selected={activeTab === 'score-keys'}
            className={activeTab === 'score-keys' ? styles.selected : ''}
            id="score-keys-tab"
            onClick={() => {
              selectTab('score-keys');
            }}
            onKeyDown={onTabKeyDown}
            ref={(element) => {
              tabRefs.current[1] = element;
            }}
            role="tab"
            tabIndex={activeTab === 'score-keys' ? 0 : -1}
            type="button"
          >
            Active Score Keys
          </button>
        </div>
      ) : null}
      {canViewStudentReports ? (
        <div
          aria-labelledby="student-reports-tab"
          className={styles.tabPanel}
          hidden={activeTab !== 'student-reports'}
          id="student-reports-panel"
          role="tabpanel"
          tabIndex={0}
        >
          <ReportWorkflowClient mode="admin" />
        </div>
      ) : null}
      <div
        aria-labelledby={canViewStudentReports ? 'score-keys-tab' : undefined}
        className={styles.tabPanel}
        hidden={canViewStudentReports && activeTab !== 'score-keys'}
        id="score-keys-panel"
        role={canViewStudentReports ? 'tabpanel' : undefined}
        tabIndex={canViewStudentReports ? 0 : undefined}
      >
        <ActiveScoreKeysReport enabled={activeTab === 'score-keys'} />
      </div>
    </div>
  );
}
