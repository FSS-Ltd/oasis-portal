import { useState } from 'react';
import { type RouterOutputs } from '../../lib/trpc';
import { StaffAttendanceScreen } from './staff-attendance-screen';
import { StaffCommunicationsScreen } from './staff-communications-screen';
import { StaffHomeScreen } from './staff-home-screen';
import { StaffRotaScreen } from './staff-rota-screen';

type SessionUser = NonNullable<RouterOutputs['health']['me']['user']>;
type StaffPortalRoute = 'home' | 'attendance' | 'communications' | 'rota';

export function StaffPortalScreen({ user }: { user: SessionUser | undefined }) {
  const [route, setRoute] = useState<StaffPortalRoute>('home');

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

  return (
    <StaffHomeScreen
      onOpenAttendance={() => {
        setRoute('attendance');
      }}
      onOpenCommunications={() => {
        setRoute('communications');
      }}
      onOpenRota={() => {
        setRoute('rota');
      }}
      user={user}
    />
  );
}
