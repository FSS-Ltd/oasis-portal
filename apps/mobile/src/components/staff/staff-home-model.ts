export interface StaffHomeSummary {
  attendance: {
    absent: number;
    late: number;
    marked: number;
    present: number;
    total: number;
    unmarked: number;
  };
  behaviour: { entriesRecordedToday: number };
  clubs: { assignedClubCount: number };
  date: string;
  notices: { unread: number };
  pace: { testsRecordedToday: number };
  permissions: {
    canUseClubs: boolean;
    canUseShopCounter: boolean;
  };
  rota: {
    nextShift: {
      bandColour: string | null;
      bandName: string | null;
      endsAt: string | Date;
      kind: 'Cover' | 'Meeting';
      startsAt: string | Date;
    } | null;
    pendingSwapCount: number;
    shiftsToday: number;
    shiftsThisWeek: number;
  };
  shop: { readyReservationCount: number };
}

export type StaffHomeQuickActionId =
  | 'attendance'
  | 'behaviour'
  | 'clubs'
  | 'communications'
  | 'pace'
  | 'rota'
  | 'shop';

export interface StaffHomeQuickAction {
  id: StaffHomeQuickActionId;
  label: string;
  meta: string;
}

export interface StaffHomeViewModel {
  attendanceCompletionPercent: number;
  attendanceProgressLabel: string;
  nextTask: {
    title: string;
    metric: string;
    tone: 'default' | 'warning';
  };
  quickActions: StaffHomeQuickAction[];
}

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export function buildStaffHomeViewModel(summary: StaffHomeSummary): StaffHomeViewModel {
  const attendanceCompletionPercent = percent(summary.attendance.marked, summary.attendance.total);
  const quickActions: StaffHomeQuickAction[] = [
    {
      id: 'attendance',
      label: 'Mark attendance',
      meta: summary.attendance.unmarked
        ? `${String(summary.attendance.unmarked)} unmarked`
        : 'Register complete',
    },
    {
      id: 'communications',
      label: 'Staff communications',
      meta: summary.notices.unread
        ? `${String(summary.notices.unread)} unread`
        : 'Noticeboard and messages',
    },
    {
      id: 'behaviour',
      label: 'Log behaviour',
      meta: `${String(summary.behaviour.entriesRecordedToday)} today`,
    },
    {
      id: 'pace',
      label: 'Record PACE score',
      meta: `${String(summary.pace.testsRecordedToday)} today`,
    },
    {
      id: 'rota',
      label: 'Open rota',
      meta: `${String(summary.rota.shiftsThisWeek)} this week`,
    },
  ];

  if (summary.permissions.canUseShopCounter) {
    quickActions.push({
      id: 'shop',
      label: 'Shop pickups',
      meta: `${String(summary.shop.readyReservationCount)} ready`,
    });
  }

  if (summary.permissions.canUseClubs) {
    quickActions.push({
      id: 'clubs',
      label: 'Club roster',
      meta: `${String(summary.clubs.assignedClubCount)} available`,
    });
  }

  let nextTask: StaffHomeViewModel['nextTask'] = {
    metric: `${String(summary.rota.shiftsToday)} today`,
    title: 'Review rota',
    tone: 'default',
  };

  if (summary.attendance.unmarked > 0) {
    nextTask = {
      metric: `${String(summary.attendance.unmarked)} unmarked`,
      title: 'Finish attendance',
      tone: 'warning',
    };
  } else if (summary.shop.readyReservationCount > 0 && summary.permissions.canUseShopCounter) {
    nextTask = {
      metric: `${String(summary.shop.readyReservationCount)} ready`,
      title: 'Collect shop reservations',
      tone: 'warning',
    };
  } else if (summary.notices.unread > 0) {
    nextTask = {
      metric: `${String(summary.notices.unread)} unread`,
      title: 'Read staff notices',
      tone: 'warning',
    };
  }

  return {
    attendanceCompletionPercent,
    attendanceProgressLabel: `${String(summary.attendance.marked)}/${String(
      summary.attendance.total,
    )} marked`,
    nextTask,
    quickActions,
  };
}
