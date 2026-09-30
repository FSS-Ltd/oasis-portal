import { useState } from 'react';
import { type RouterOutputs } from '../../lib/trpc';
import { UserAccessScreen } from '../access/user-access-screen';
import { Badge, MutedText, SectionTitle } from '../core/mobile-ui';
import { PortalMobileHeader } from '../core/portal-mobile-shell';
import { StaffAcademicInventoryScreen } from './staff-academic-inventory-screen';
import { StaffAttendanceScreen } from './staff-attendance-screen';
import { StaffBehaviourScreen } from './staff-behaviour-screen';
import { StaffClubLeadScreen } from './staff-club-lead-screen';
import { StaffClubManagerScreen } from './staff-club-manager-screen';
import { StaffCommunicationsScreen } from './staff-communications-screen';
import { StaffHomeScreen } from './staff-home-screen';
import { StaffIncidentScreen } from './staff-incident-screen';
import { StaffPaceScreen } from './staff-pace-screen';
import { StaffRotaScreen } from './staff-rota-screen';
import { StaffShopCounterScreen } from './staff-shop-counter-screen';
import { MobileHeadTimetableScreen } from '../timetable/mobile-head-timetable-screen';
import { StaffLibraryScreen } from './staff-library-screen';
import { StaffScoreKeyReportScreen } from '../reports/staff-score-key-report-screen';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type StaffPortalRoute =
  | 'home'
  | 'academic-inventory'
  | 'attendance'
  | 'behaviour'
  | 'club-manager'
  | 'clubs'
  | 'communications'
  | 'incidents'
  | 'library'
  | 'pace'
  | 'reports'
  | 'rota'
  | 'shop'
  | 'timetables'
  | 'user-access';

export function StaffPortalScreen({
  onSwitchToParent,
  user,
}: {
  onSwitchToParent?: () => void;
  user: SessionUser | undefined;
}) {
  const [route, setRoute] = useState<StaffPortalRoute>('home');

  if (route === 'academic-inventory') {
    return (
      <StaffAcademicInventoryScreen
        onBack={() => {
          setRoute('home');
        }}
        user={user}
      />
    );
  }

  if (route === 'attendance') {
    return (
      <StaffAttendanceScreen
        onBack={() => {
          setRoute('home');
        }}
        user={user}
      />
    );
  }

  if (route === 'communications') {
    return (
      <StaffCommunicationsScreen
        onBack={() => {
          setRoute('home');
        }}
        user={user}
      />
    );
  }

  if (route === 'behaviour') {
    return (
      <StaffBehaviourScreen
        onBack={() => {
          setRoute('home');
        }}
        user={user}
      />
    );
  }

  if (route === 'clubs') {
    return (
      <StaffClubLeadScreen
        onBack={() => {
          setRoute('home');
        }}
        user={user}
      />
    );
  }

  if (route === 'club-manager') {
    return (
      <StaffClubManagerScreen
        onBack={() => {
          setRoute('home');
        }}
        user={user}
      />
    );
  }

  if (route === 'pace') {
    return (
      <StaffPaceScreen
        onBack={() => {
          setRoute('home');
        }}
        user={user}
      />
    );
  }

  if (route === 'reports') {
    return (
      <StaffScoreKeyReportScreen
        onBack={() => {
          setRoute('home');
        }}
      />
    );
  }

  if (route === 'incidents') {
    return (
      <StaffIncidentScreen
        onBack={() => {
          setRoute('home');
        }}
        user={user}
      />
    );
  }

  if (route === 'library' && user?.tags.includes('librarian')) {
    return (
      <StaffLibraryScreen
        onBack={() => {
          setRoute('home');
        }}
      />
    );
  }

  if (route === 'rota') {
    return (
      <StaffRotaScreen
        onBack={() => {
          setRoute('home');
        }}
        user={user}
      />
    );
  }

  if (route === 'shop') {
    return (
      <StaffShopCounterScreen
        onBack={() => {
          setRoute('home');
        }}
        user={user}
      />
    );
  }

  if (route === 'timetables' && user?.role === 'Head') {
    return (
      <MobileHeadTimetableScreen
        onBack={() => {
          setRoute('home');
        }}
      />
    );
  }

  if (route === 'user-access' && user?.role === 'Head') {
    return (
      <UserAccessScreen
        currentUserId={user.id}
        header={
          <PortalMobileHeader
            actionAccessibilityLabel="Return to staff home"
            actionLabel="Back"
            avatarLabel="H"
            eyebrow="Staff Portal"
            onActionPress={() => {
              setRoute('home');
            }}
            subtitle="User Access"
            title="Oasis Learning Centre"
            variant="dark"
          />
        }
        introduction={
          <>
            <Badge variant="blue">Head</Badge>
            <SectionTitle>User Access</SectionTitle>
            <MutedText>
              Manage account invitations, profiles, roles, permissions, and sign-in status.
            </MutedText>
          </>
        }
      />
    );
  }

  return (
    <StaffHomeScreen
      onOpenAcademicInventory={() => {
        setRoute('academic-inventory');
      }}
      onOpenAttendance={() => {
        setRoute('attendance');
      }}
      onOpenBehaviour={() => {
        setRoute('behaviour');
      }}
      onOpenCommunications={() => {
        setRoute('communications');
      }}
      onOpenClubManager={() => {
        setRoute('club-manager');
      }}
      onOpenClubs={() => {
        setRoute('clubs');
      }}
      onOpenIncidents={() => {
        setRoute('incidents');
      }}
      {...(user?.tags.includes('librarian')
        ? {
            onOpenLibrary: () => {
              setRoute('library');
            },
          }
        : {})}
      onOpenPace={() => {
        setRoute('pace');
      }}
      onOpenRota={() => {
        setRoute('rota');
      }}
      onOpenReports={() => {
        setRoute('reports');
      }}
      onOpenShop={() => {
        setRoute('shop');
      }}
      onOpenTimetables={
        user?.role === 'Head'
          ? () => {
              setRoute('timetables');
            }
          : undefined
      }
      onOpenUserAccess={
        user?.role === 'Head'
          ? () => {
              setRoute('user-access');
            }
          : undefined
      }
      user={user}
      {...(onSwitchToParent ? { onSwitchToParent } : {})}
    />
  );
}
